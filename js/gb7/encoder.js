export class GB7Encoder {
    constructor() {
        this.signature = [0x47, 0x42, 0x37, 0x1D];
    }

    encode(imageData, hasMask = false) {
        // Будет реализовано в 4-м коммите
        throw new Error('GB7 encoder будет реализован позже');
    }

    download(imageData, filename = 'image.gb7', hasMask = false) {
        console.log('GB7 download будет реализован позже');
    }
}