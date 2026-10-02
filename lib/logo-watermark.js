export function addWatermark(ctx, width, height, text = 'Silent Wolf') {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeText(text, width / 2, height - 10);
    ctx.fillText(text, width / 2, height - 10);
    ctx.restore();
}
