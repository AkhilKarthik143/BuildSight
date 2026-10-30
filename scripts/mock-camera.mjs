/** Fixed, textured camera stream for deterministic AR browser tests. */
export async function installMockCamera(page) {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    let shifted = false;
    const draw = () => {
      ctx.fillStyle = shifted ? "#e9e0dc" : "#183623";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < 720; y += 20) for (let x = 0; x < 1280; x += 20) {
        const light = ((x * 17 + y * 31 + x * y * 3) % 13) * 5;
        ctx.fillStyle = shifted ? `rgb(${light + 175}, ${light + 165}, ${light + 170})` : `rgb(${light + 15}, ${light + 45}, ${light + 10})`;
        ctx.fillRect(x + 2, y + 2, 13, 13);
      }
      ctx.fillStyle = shifted ? "#e8b9ad" : "#48bf37";
      ctx.beginPath();
      ctx.ellipse(635, 435, 190, 130, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let x = 510; x <= 760; x += 35) {
        ctx.fillStyle = shifted ? "#fff8ed" : "#17632a";
        ctx.beginPath(); ctx.arc(x, 385, 9, 0, Math.PI * 2); ctx.fill();
      }
    };
    draw();
    window.setInterval(draw, 250);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => canvas.captureStream(15) });
    window.moveMockCamera = () => { shifted = !shifted; draw(); };
  });
}
