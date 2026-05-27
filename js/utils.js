export class ImageUtils {
    static getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }
    
    static readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsArrayBuffer(file);
        });
    }
    
    static readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsDataURL(file);
        });
    }
    
    static loadImageFromURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
            img.src = url;
        });
    }
    
        /**
     * Определяет количество каналов по содержимому ImageData
     * @param {ImageData} imageData
     * @returns {number} - 1 (Gray), 2 (Gray+Alpha), 3 (RGB), 4 (RGBA)
     */
    static detectChannelCount(imageData) {
        const data = imageData.data;
        let hasColor = false;
        let hasTransparency = false;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) {
                hasColor = true;
            }
            if (data[i + 3] < 255) {
                hasTransparency = true;
            }
            if (hasColor && hasTransparency) break;
        }

        if (hasColor && hasTransparency) return 4; // RGBA
        if (hasColor) return 3;                    // RGB
        if (hasTransparency) return 2;             // Gray + Alpha
        return 1;                                  // Gray
    }
}
