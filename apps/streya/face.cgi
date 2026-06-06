#! /usr/bin/env node
// Experimental Face Generator

// Random helper functions
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const randChoice = (arr) => arr[randInt(0, arr.length - 1)];

class Face {
    constructor({} = {}) {
        this.#skinTone = randChoice([
            '#F5CBA7', '#FAD7A0', '#E59866', '#D35400', '#BA4A00',
            '#EDBB99', '#DC7633', '#A04000', '#6E2C00', '#F7DC6F',
            '#F0E68C', '#CD853F', '#8B4513' ]);
        this.#eyeColor = randChoice([
            "#6B4E3A", "#8B5A2B", "#A67C52", "#7D6B4A", "#5E6B4A",
            "#4A6B5A", "#9CAF88", "#7A8F8F", "#5D7A8C", "#4C6A8B",
            "#8F7C6B", "#5C5C5C" ]);
        this.#faceHeight = rand(0.75, 0.85);
        this.#faceWidth  = rand(0.55, 0.8);
        this.#chinWidth  = rand(0.55, 0.8);
        this.#eyeDist    = rand(0.4, 0.6);
        this.#eyeSize    = rand(0.08, 0.12);
        this.#eyeTilt    = rand(-Math.PI / 6, Math.PI / 6);
    }

    #faceHeight; get faceHeight() { return this.#faceHeight; }
    #faceWidth;  get faceWidth()  { return this.#faceWidth; }
    #chinWidth;  get chinWidth()  { return this.#chinWidth; }
    #skinTone;   get skinTone()   { return this.#skinTone; }
    #eyeColor;   get eyeColor()   { return this.#eyeColor; }
    #eyeDist;    get eyeDist()    { return this.#eyeDist; }
    #eyeSize;    get eyeSize()    { return this.#eyeSize; }
    #eyeTilt;    get eyeTilt()    { return this.#eyeTilt; }

    renderSVG({ size = 512, noFrame = false } = {}) {
        const result = [];
        const corner      = Math.max(Math.floor(size /   8), 1);
        const strokeWidth = Math.max(Math.floor(size / 128), 1);
        const width   = size,     height  = size;
        const centerX = size / 2, centerY = size / 2;

        if (!noFrame)
            result.push(...[
                `<svg xmlns="http://www.w3.org/2000/svg"`,
                `     width="${width}" height="${width}"`,
                `     viewBox="0 0 ${width} ${height}">`,
                `  <rect width="${width}" height="${height}"`,
                `        rx="${corner}" fill="#EEE"`,
                `        stroke-width="${strokeWidth}" stroke="#111"/>`,
            ]);

        const faceHeight = this.faceHeight * size;
        const faceWidth  = this.faceWidth * size;
        const chinWidth  = this.chinWidth * size;
        const margin = size - faceWidth;
        const earR = {x: (size - faceWidth) / 2,
                      y : (size - faceHeight) / 2 + faceHeight / 3};
        const earL = {x: (size + faceWidth) / 2,
                      y : (size - faceHeight) / 2 + faceHeight / 3};
        const chinP = {x: size / 2, y: size - (size - faceHeight) / 2};
        const ctrlP = [
            {x: (2 * size - faceWidth - chinWidth) / 4,
             y: size * 2 / 10 + chinP.y / 2},
            {x: (size - chinWidth) / 2, y: chinP.y},
            {x: size - (2 * size - faceWidth - chinWidth) / 4,
             y: size * 2 / 10 + chinP.y / 2}];
        result.push(...[
            `  <path d="M ${earL.x},${earL.y}`,
            `           A ${faceWidth/2},${faceHeight/3} 0 0 0`,
            `             ${earR.x},${earR.y}`,
            `           C ${ctrlP[0].x},${ctrlP[0].y}`,
            `             ${ctrlP[1].x},${ctrlP[1].y}`,
            `             ${chinP.x},${chinP.y}`,
            `           S ${ctrlP[2].x},${ctrlP[2].y}`,
            `             ${earL.x},${earL.y} Z"`,
            `        fill="${this.skinTone}"/>`
        ]);

        const eyeR = {x: size * (1 - this.eyeDist / 2) / 2,
                      y: size / 2, r: this.eyeSize * size / 2,
                      rx: this.eyeSize * size * 3 / 4,
                      ry: this.eyeSize * size / 2};
        const eyeL = {x: size * (1 + this.eyeDist / 2) / 2,
                      y: size / 2, r: this.eyeSize * size / 2,
                      rx: this.eyeSize * size * 3 / 4,
                      ry: this.eyeSize * size / 2};
        const tilt = this.eyeTilt * 180 / Math.PI;
        const eyeR_trans = `rotate(${tilt},${eyeR.x},${eyeR.y})`;
        const eyeL_trans = `rotate(${-tilt},${eyeL.x},${eyeL.y})`;
        result.push(...[
            `  <ellipse cx="${eyeR.x}" cy="${eyeR.y}"`,
            `           rx="${eyeR.rx}" ry="${eyeR.ry}" fill="#eee"`,
            `           transform="${eyeR_trans}" />`,
            `  <circle  cx="${eyeR.x}" cy="${eyeR.y}"`,
            `           r="${eyeR.r}"`,
            `           fill="${this.eyeColor}"/>`,
            `  <circle  cx="${eyeR.x}" cy="${eyeR.y}"`,
            `           r="${eyeR.r * 4 / 10}"`,
            `           fill="#111"/>`,
            `  <ellipse cx="${eyeL.x}" cy="${eyeL.y}"`,
            `           rx="${eyeL.rx}" ry="${eyeL.ry}" fill="#eee"`,
            `           transform="${eyeL_trans}"/>`,
            `  <circle  cx="${eyeL.x}" cy="${eyeL.y}"`,
            `           r="${eyeL.r}"`,
            `           fill="${this.eyeColor}"/>`,
            `  <circle  cx="${eyeL.x}" cy="${eyeL.y}"`,
            `           r="${eyeL.r * 4 / 10}"`,
            `           fill="#111"/>`,
        ]);
        // TODO: eyelids (monolid?)
        // TODO: eyelashes
        // TODO: eyebrows
        // TODO: nose (width, up/down, position, nostrils)
        // TODO: hair (style, color)
        // TODO: mouth (width, height,lips)
        // TODO: age lines (laugh, brow, wrinkles)
        // TODO: glasses
        // TODO: beauty marks
        // TODO: facial hair

        if (!noFrame)
            result.push('</svg>');
        result.push('');
        return result.join('\n');
    }
}

const face = new Face();
const svgData = face.renderSVG();

console.log("Content-Type: image/svg+xml");
console.log("Content-Length: " + Buffer.byteLength(svgData, 'utf8'));
console.log("");
process.stdout.write(svgData);

process.stderr.write(`DEBUG ${face.eyeTilt}\n`);
