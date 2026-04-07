import type { VercelRequest, VercelResponse } from '@vercel/node';
import Parser from 'rss-parser';

const parser = new Parser();

// 💡 СЮДА ВЫ МОЖЕТЕ ДОБАВЛЯТЬ ЛЮБЫЕ СВОИ ССЫЛКИ
const RSS_FEEDS = [
    'https://www.kinopoisk.ru/news.rss',
    'https://kanobu.ru/rss/news.xml',
    'https://www.kinonews.ru/rss/',
    'https://kg-portal.ru/rss/news_anime.rss',
    'https://kg-portal.ru/rss/news_tv.rss',
    'https://kg-portal.ru/rss/news.rss',
    'https://kg-portal.ru/rss/news_all.rss'
];

// Алгоритм сравнения строк (Сёренсен-Дайс)
function getSimilarity(str1: string, str2: string): number {
    const clean1 = str1.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()«»"']/g, "");
    const clean2 = str2.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()«»"']/g, "");

    if (clean1 === clean2) return 1.0;
    if (clean1.length < 2 || clean2.length < 2) return 0.0;

    const getBigrams = (str: string) => {
        const bigrams = new Set<string>();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.slice(i, i + 2));
        }
        return bigrams;
    };

    const bg1 = getBigrams(clean1);
    const bg2 = getBigrams(clean2);

    let intersection = 0;
    for (const bg of bg1) {
        if (bg2.has(bg)) intersection++;
    }

    return (2.0 * intersection) / (bg1.size + bg2.size);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        let allArticles: any[] = [];

        // Асинхронно скачиваем все ленты ОДНОВРЕМЕННО
        const feedPromises = RSS_FEEDS.map(url => parser.parseURL(url).catch(e => {
            console.error(`Ошибка загрузки ${url}:`, e.message);
            return null; // Если один сайт упал, продолжаем работу
        }));

        const feeds = await Promise.all(feedPromises);

        // Парсим и стандартизируем данные
        for (const feed of feeds) {
            if (!feed) continue;
            
            const items = feed.items.map(item => {
                let imageUrl = item.enclosure?.url || "";
                
                if (!imageUrl && item.content) {
                    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
                    if (imgMatch) imageUrl = imgMatch[1];
                }

                let cleanSnippet = (item.contentSnippet || item.content || "")
                    .replace(/<[^>]*>?/gm, '') 
                    .replace(/\n/g, ' ')       
                    .trim()
                    .substring(0, 120) + "...";

                return {
                    id: item.guid || item.link || Math.random().toString(),
                    title: item.title?.replace(/&quot;/g, '"') || "Без заголовка",
                    link: item.link,
                    pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    snippet: cleanSnippet,
                    imageUrl: imageUrl,
                    sourceName: feed.title || "Новости"
                };
            });
            
            allArticles = allArticles.concat(items);
        }

        // Сортировка по дате (сначала свежие)
        allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

        // Дедупликация (удаление похожих новостей)
        const uniqueArticles: any[] = [];
        const SIMILARITY_THRESHOLD = 0.65; 

        for (const article of allArticles) {
            let isDuplicate = false;

            for (const unique of uniqueArticles) {
                const similarity = getSimilarity(article.title, unique.title);
                if (similarity > SIMILARITY_THRESHOLD) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                uniqueArticles.push(article);
            }
        }

        // Пагинация
        const page = parseInt((req.query.page as string) || '1');
        const limit = 20; 
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedArticles = uniqueArticles.slice(startIndex, endIndex);

        // Кэшируем: 15 мин на серверах CDN, 1 час фонового обновления
        res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
        
        return res.status(200).json({
            success: true,
            data: paginatedArticles,
            meta: {
                page: page,
                total_results: uniqueArticles.length 
            }
        });

    } catch (error: any) {
        console.error("Global Aggregator Error:", error);
        return res.status(500).json({
            success: false,
            error: { code: 'NEWS_FETCH_ERROR', message: error.message }
        });
    }
}