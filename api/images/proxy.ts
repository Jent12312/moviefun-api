import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Получаем параметры пути и размера из запроса
        // Пример запроса: /api/images/proxy?path=/1x9e...jpg&size=w500
        const path = req.query.path as string;
        const size = (req.query.size as string) || 'w500'; // По умолчанию размер w500

        if (!path) {
            return res.status(400).json({ success: false, error: 'Image path is required' });
        }

        // Формируем оригинальный URL до TMDB
        const tmdbImageUrl = `https://image.tmdb.org/t/p/${size}${path}`;

        // Скачиваем картинку сервером Vercel
        const response = await fetch(tmdbImageUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch image from TMDB: ${response.status}`);
        }

        // Получаем бинарные данные картинки
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Определяем Content-Type (обычно image/jpeg)
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        
        // ВАЖНО: Настраиваем кэширование CDN! (Production стандарт)
        // Браузер/Приложение кэширует на 1 день (max-age=86400)
        // Сервера Vercel кэшируют на 30 дней (s-maxage=2592000)
        // Это спасет нас от исчерпания лимитов Vercel и сделает загрузку мгновенной
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000');

        // Отправляем бинарник клиенту
        return res.send(buffer);

    } catch (error: any) {
        console.error('Image proxy error:', error);
        return res.status(500).json({ 
            success: false, 
            error: { code: 'IMAGE_PROXY_ERROR', message: error.message } 
        });
    }
}