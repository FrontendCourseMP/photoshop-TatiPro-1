export class GB7Decoder {
    constructor() {
        // Сигнатура файла: 'GB7·'
        this.signature = [0x47, 0x42, 0x37, 0x1D];
    }

    /**
     * Декодирует GB7 файл из ArrayBuffer
     * @param {ArrayBuffer} buffer - бинарные данные файла
     * @returns {Object} - { width, height, hasMask, pixels, maskData, version }
     */
    decode(buffer) {
        const dataView = new DataView(buffer);
        let offset = 0;

        // Проверяем сигнатуру (4 байта)
        const signature = [
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        ];

        if (!this.signature.every((byte, i) => byte === signature[i])) {
            throw new Error('Неверная сигнатура файла GB7. Ожидалось: GB7');
        }
        offset += 4;

        // Читаем версию (1 байт)
        const version = dataView.getUint8(offset++);
        if (version !== 0x01) {
            throw new Error(`Неподдерживаемая версия GB7: ${version}. Поддерживается только версия 1`);
        }

        // Читаем флаги (1 байт)
        const flags = dataView.getUint8(offset++);
        const hasMask = (flags & 0x01) === 1; // Бит 0 - флаг маски

        // Читаем ширину (2 байта, big-endian)
        const width = dataView.getUint16(offset);
        offset += 2;

        // Читаем высоту (2 байта, big-endian)
        const height = dataView.getUint16(offset);
        offset += 2;

        // Пропускаем зарезервированные байты (2 байта)
        offset += 2;

        // Проверяем, что размер данных соответствует заявленному
        const expectedDataSize = width * height;
        const actualDataSize = buffer.byteLength - offset;
        
        if (actualDataSize < expectedDataSize) {
            throw new Error(`Недостаточно данных: ожидалось ${expectedDataSize} байт, получено ${actualDataSize}`);
        }

        // Читаем данные пикселей
        const pixels = new Uint8Array(width * height);
        const maskData = hasMask ? new Uint8Array(width * height) : null;

        for (let i = 0; i < width * height; i++) {
            const byte = dataView.getUint8(offset++);
            
            // Извлекаем 7-битное значение серого (биты 0-6)
            const grayValue = byte & 0x7F; // 0-127
            
            // Преобразуем 7-бит (0-127) в 8-бит (0-255) для отображения
            // Используем формулу: value * 255 / 127
            pixels[i] = Math.round((grayValue / 127) * 255);

            // Извлекаем бит маски (бит 7)
            if (hasMask) {
                maskData[i] = (byte & 0x80) >> 7; // 0 или 1
            }
        }

        console.log(`GB7 декодирован: ${width}x${height}, маска: ${hasMask ? 'да' : 'нет'}`);

        return {
            width,
            height,
            hasMask,
            pixels,
            maskData,
            version
        };
    }

    /**
     * Создает ImageData для canvas из декодированных данных
     * @param {Object} decoded - результат decode()
     * @returns {ImageData}
     */
    createImageData(decoded) {
        const imageData = new ImageData(decoded.width, decoded.height);
        const data = imageData.data;

        for (let i = 0; i < decoded.pixels.length; i++) {
            const pixelIndex = i * 4;
            const grayValue = decoded.pixels[i];

            // RGB каналы получают одинаковое значение для серого цвета
            data[pixelIndex] = grayValue;     // R
            data[pixelIndex + 1] = grayValue; // G
            data[pixelIndex + 2] = grayValue; // B

            // Альфа-канал
            if (decoded.hasMask) {
                // maskData[i] === 1 -> пиксель видимый (альфа = 255)
                // maskData[i] === 0 -> пиксель прозрачный (альфа = 0)
                data[pixelIndex + 3] = decoded.maskData[i] ? 255 : 0;
            } else {
                data[pixelIndex + 3] = 255; // Полностью непрозрачный
            }
        }

        return imageData;
    }
}