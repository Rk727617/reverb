/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioEngine {
  private context: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  
  private gainNode: GainNode;
  private bassNode: BiquadFilterNode;
  private reverbNode: ConvolverNode;
  private reverbGain: GainNode;
  private dryGain: GainNode;
  private analyser: AnalyserNode;
  
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 44100
    });
    
    this.gainNode = this.context.createGain();
    this.bassNode = this.context.createBiquadFilter();
    this.bassNode.type = 'lowshelf';
    this.bassNode.frequency.value = 200;
    
    this.reverbNode = this.context.createConvolver();
    this.reverbGain = this.context.createGain();
    this.dryGain = this.context.createGain();
    
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;

    // Routing: Source -> Bass -> Analyser -> Split (Dry/Reverb) -> Gain -> Destination
    this.bassNode.connect(this.analyser);
    this.analyser.connect(this.dryGain);
    this.analyser.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);
    
    this.dryGain.connect(this.gainNode);
    this.reverbGain.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);

    this.setReverb(0);
    this.generateImpulseResponse(2.5, 2.0); // Default IR
  }

  async loadAudio(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    this.buffer = await this.context.decodeAudioData(arrayBuffer);
    this.stop();
    this.pauseOffset = 0;
    return this.buffer;
  }

  play(speed: number = 1) {
    if (!this.buffer || this.isPlaying) return;

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.playbackRate.value = speed;
    
    this.source.connect(this.bassNode);
    
    this.startTime = this.context.currentTime;
    this.source.start(0, this.pauseOffset);
    this.isPlaying = true;

    this.source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pauseOffset = 0;
      }
    };
  }

  pause() {
    if (!this.isPlaying || !this.source) return;
    
    this.source.stop();
    this.pauseOffset += (this.context.currentTime - this.startTime) * this.source.playbackRate.value;
    this.isPlaying = false;
  }

  stop() {
    if (this.source) {
      this.source.stop();
      this.source = null;
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
  }

  seek(percent: number) {
    if (!this.buffer) return;
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseOffset = percent * this.buffer.duration;
    if (wasPlaying) {
      this.play();
    }
  }

  setVolume(value: number) {
    this.gainNode.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  setSpeed(value: number) {
    if (this.source) {
      this.source.playbackRate.setTargetAtTime(value, this.context.currentTime, 0.01);
    }
  }

  setBass(value: number) {
    this.bassNode.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  setReverb(value: number) {
    // value 0 to 1
    this.reverbGain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    this.dryGain.gain.setTargetAtTime(1 - value * 0.5, this.context.currentTime, 0.01);
  }

  getAnalyser() {
    return this.analyser;
  }

  getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseOffset;
    return this.pauseOffset + (this.context.currentTime - this.startTime) * (this.source?.playbackRate.value || 1);
  }

  getDuration(): number {
    return this.buffer?.duration || 0;
  }

  private generateImpulseResponse(duration: number, decay: number) {
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.context.createBuffer(2, length, sampleRate);
    
    for (let i = 0; i < 2; i++) {
      const channelData = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
      }
    }
    this.reverbNode.buffer = impulse;
  }

  async exportWav(speed: number, reverb: number, bass: number): Promise<Blob> {
    if (!this.buffer) throw new Error("No audio loaded");

    const offlineCtx = new OfflineAudioContext(
      this.buffer.numberOfChannels,
      (this.buffer.length / speed),
      this.buffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = speed;

    const bassNode = offlineCtx.createBiquadFilter();
    bassNode.type = 'lowshelf';
    bassNode.frequency.value = 200;
    bassNode.gain.value = bass;

    const reverbNode = offlineCtx.createConvolver();
    // Generate IR for offline context
    const length = offlineCtx.sampleRate * 2.5;
    const impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channelData = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 2.0);
      }
    }
    reverbNode.buffer = impulse;

    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = reverb;
    const dryGain = offlineCtx.createGain();
    dryGain.gain.value = 1 - reverb * 0.5;

    source.connect(bassNode);
    bassNode.connect(dryGain);
    bassNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    
    dryGain.connect(offlineCtx.destination);
    reverbGain.connect(offlineCtx.destination);

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while(pos < length) {
      for(i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true);          // write 16-bit sample
        pos += 2;
      }
      offset++;                                     // next sample yara
    }

    return new Blob([bufferArr], {type: "audio/wav"});

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }
}
