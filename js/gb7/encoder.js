export class GB7Encoder {
    constructor() {
        this.signature = [0x47, 0x42, 0x37, 0x1D]; // 'GB7·'
    }

    /**
     * Кодирует изображение в формат GB7
     * @param {ImageData} imageData - данные изображения из canvas
     * @param {boolean} hasMask - использовать ли альфа-канал как маску
     * @returns {ArrayBuffer} - бинарные данные в формате GB7
     */
    encode(imageData, hasMask = false) {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data; // Uint8ClampedArray (RGBA)
        
        // Размер заголовка: 4(сигнатура) + 1(версия) + 1(флаги) + 2(ширина) + 2(высота) + 2(резерв) = 12 байт
        const headerSize = 12;
        const dataSize = width * height;
        const bufferSize = headerSize + dataSize;
        
        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);
        let offset = 0;

        // 1. Записываем сигнатуру (4 байта)
        this.signature.forEach(byte => {
            view.setUint8(offset++, byte);
        });

        // 2. Версия (1 байт) - всегда 0x01
        view.setUint8(offset++, 0x01);

        // 3. Флаги (1 байт)
        // Бит 0: флаг маски, биты 1-7: зарезервированы (0)
        const flags = hasMask ? 0x01 : 0x00;
        view.setUint8(offset++, flags);

        // 4. Ширина (2 байта, big-endian)
        view.setUint16(offset, width);
        offset += 2;

        // 5. Высота (2 байта, big-endian)
        view.setUint16(offset, height);
        offset += 2;

        // 6. Зарезервированные байты (2 байта, должны быть 0x0000)
        view.setUint16(offset, 0x0000);
        offset += 2;

        // 7. Данные пикселей (построчно, слева направо, сверху вниз)
        for (let i = 0; i < width * height; i++) {
            const pixelIndex = i * 4;
            
            // Получаем значения RGBA
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            const a = pixels[pixelIndex + 3];
            
            // Преобразуем RGB в оттенки серого (стандартная формула яркости)
            const gray8Bit = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Конвертируем из 8-бит (0-255) в 7-бит (0-127)
            const gray7Bit = Math.round((gray8Bit / 255) * 127);
            
            // Формируем байт пикселя
            let pixelByte = gray7Bit & 0x7F; // Биты 0-6: значение серого
            
            // Бит 7: маска (если используется)
            if (hasMask) {
                // Если альфа > 128 — пиксель видимый (бит 7 = 1)
                // Если альфа <= 128 — пиксель прозрачный (бит 7 = 0)
                if (a > 128) {
                    pixelByte |= 0x80; // Устанавливаем бит 7 в 1
                }
            }
            // Если маска не используется, бит 7 должен быть 0 (уже так и есть)
            
            view.setUint8(offset++, pixelByte);
        }

        console.log(`GB7 закодирован: ${width}x${height}, маска: ${hasMask ? 'да' : 'нет'}, размер: ${bufferSize} байт`);
        
        return buffer;
    }

    /**
     * Создает Blob из закодированных данных
     * @param {ImageData} imageData 
     * @param {boolean} hasMask 
     * @returns {Blob}
     */
    createBlob(imageData, hasMask = false) {
        const buffer = this.encode(imageData, hasMask);
        return new Blob([buffer], { type: 'application/octet-stream' });
    }

    /**
     * Скачивает изображение в формате GB7
     * @param {ImageData} imageData - данные из canvas
     * @param {string} filename - имя файла
     * @param {boolean} hasMask - сохранять ли с маской
     */
    download(imageData, filename = 'image.gb7', hasMask = false) {
        try {
            const blob = this.createBlob(imageData, hasMask);
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Освобождаем память
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log(`Файл сохранен: ${filename}`);
        } catch (error) {
            console.error('Ошибка сохранения GB7:', error);
            throw new Error('Не удалось сохранить GB7 файл: ' + error.message);
        }
    }
}