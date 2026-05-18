/**
 * Модуль для расчёта и отрисовки гистограммы изображения
 * Поддерживает линейную и логарифмическую шкалу
 * Может строить гистограмму как для Master (яркость), так и для отдельных каналов
 */
export class Histogram {
    /**
     * @param {HTMLCanvasElement} canvas - canvas для отрисовки гистограммы
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = new Array(256).fill(0); // 256 уровней (0-255)
        this.maxValue = 0;
        this.scale = 'linear'; // 'linear' или 'log'
    }

    /**
     * Рассчитывает гистограмму из ImageData
     * @param {ImageData} imageData - данные изображения
     * @param {string} channel - 'master', 'red', 'green', 'blue', 'alpha'
     */
    calculate(imageData, channel = 'master') {
        // Обнуляем массив
        this.data = new Array(256).fill(0);
        
        const pixels = imageData.data;
        
        for (let i = 0; i < pixels.length; i += 4) {
            let value;
            
            switch (channel) {
                case 'red':
                    value = pixels[i]; // R
                    break;
                case 'green':
                    value = pixels[i + 1]; // G
                    break;
                case 'blue':
                    value = pixels[i + 2]; // B
                    break;
                case 'alpha':
                    value = pixels[i + 3]; // A
                    break;
                case 'master':
                default:
                    // Вычисляем яркость по формуле BT.601
                    value = Math.round(
                        0.299 * pixels[i] + 
                        0.587 * pixels[i + 1] + 
                        0.114 * pixels[i + 2]
                    );
                    break;
            }
            
            // Увеличиваем счётчик для этого уровня
            this.data[value]++;
        }
        
        // Находим максимальное значение для масштабирования
        this.maxValue = Math.max(...this.data, 1);
    }

    /**
     * Устанавливает шкалу отображения
     * @param {string} scale - 'linear' или 'log'
     */
    setScale(scale) {
        this.scale = scale;
    }

    /**
     * Отрисовывает гистограмму на canvas
     */
    draw() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Очищаем canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Фон
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, width, height);
        
        if (this.maxValue === 0) return;
        
        const barWidth = width / 256;
        
        // Рисуем столбцы
        for (let i = 0; i < 256; i++) {
            let barHeight;
            
            if (this.scale === 'log') {
                // Логарифмическая шкала: log(value + 1) / log(max + 1)
                barHeight = this.data[i] > 0 
                    ? (Math.log(this.data[i] + 1) / Math.log(this.maxValue + 1)) * height
                    : 0;
            } else {
                // Линейная шкала: value / max
                barHeight = (this.data[i] / this.maxValue) * height;
            }
            
            // Градиент цвета столбца (от чёрного к синему)
            const intensity = Math.floor((i / 255) * 180 + 40);
            this.ctx.fillStyle = `rgb(${intensity}, ${intensity}, 255)`;
            
            this.ctx.fillRect(
                Math.floor(i * barWidth), 
                height - barHeight, 
                Math.ceil(barWidth), 
                barHeight
            );
        }
        
        // Рисуем базовую линию
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height - 0.5);
        this.ctx.lineTo(width, height - 0.5);
        this.ctx.stroke();
    }
}