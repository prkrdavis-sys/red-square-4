const pixel = new Uint8ClampedArray(4);
const context = {
  fillStyle: '',
  globalCompositeOperation: 'source-over',
  fillRect() {},
  drawImage() {},
  getImageData() {
    return { data: pixel };
  },
  putImageData() {},
  createImageData() {
    return { data: pixel };
  },
};

HTMLCanvasElement.prototype.getContext = (() => context) as unknown as HTMLCanvasElement['getContext'];

const offline = () => Promise.reject(new Error('offline'));
globalThis.fetch = offline;
