import type { VercelRequest, VercelResponse } from '@vercel/node';
import Parser from 'rss-parser';

const parser = new Parser();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // Парсим RSS-ленту новостей кино (например, film.ru)
        const feed = await parser.parseURL('https://www.film.ru/news.rss');

        const articles = feed.items.map(item => ({
            id: item.guid || item.link,
            title: item.title,
            link: item.link, // Ссылка на полную статью
            pubDate: item.pubDate,
            snippet: item.contentSnippet || "", // Краткое описание
            // Обычно в RSS картинка лежит в enclosure
            imageUrl: item.enclosure?.url || "" 
        })).slice(0, 20); // Берем 20 последних новостей

        // Кэшируем на 30 минут, чтобы не спамить Film.ru запросами
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
        
        return res.status(200).json({
            success: true,
            data: articles
        });

    } catch (error: any) {
        console.error("RSS Error:", error);
        return res.status(500).json({
            success: false,
            error: { code: 'NEWS_FETCH_ERROR', message: error.message }
        });
    }
}