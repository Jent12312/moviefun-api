import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' }
        });
    }

    try {
        const { url } = req.query;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_URL', message: 'URL parameter is required' }
            });
        }

        let fullText = '';
        let title = '';
        let publishedAt = '';

        // Определяем источник и парсим соответственно
        if (url.includes('kanobu.ru')) {
            const response = await fetch(url);
            const html = await response.text();

            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
            if (titleMatch) title = titleMatch[1].trim();

            const contentMatch = html.match(/<article[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/article>/);
            if (contentMatch) {
                fullText = contentMatch[1]
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            if (!fullText) {
                const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/g);
                if (pMatch) {
                    fullText = pMatch.map(p => p.replace(/<[^>]+>/g, '').trim())
                        .filter(t => t.length > 50)
                        .join('\n\n');
                }
            }

            const dateMatch = html.match(/<time[^>]*datetime="([^"]+)"/);
            if (dateMatch) publishedAt = dateMatch[1];

        } else if (url.includes('kinonews.ru')) {
            const response = await fetch(url);
            const html = await response.text();

            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
            if (titleMatch) title = titleMatch[1].trim();

            const contentBlock = html.match(/<div[^>]*class="[^"]*news-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            if (contentBlock) {
                fullText = contentBlock[1]
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            const dateMatch = html.match(/<span[^>]*class="date[^"]*"[^>]*>([^<]+)<\/span>/);
            if (dateMatch) publishedAt = dateMatch[1];

        } else if (url.includes('kg-portal.ru')) {
            const response = await fetch(url);
            const html = await response.text();

            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
            if (titleMatch) title = titleMatch[1].trim();

            const contentBlock = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            if (contentBlock) {
                fullText = contentBlock[1]
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            const dateMatch = html.match(/<span[^>]*class="date[^"]*"[^>]*>([^<]+)<\/span>/);
            if (dateMatch) publishedAt = dateMatch[1];

        } else {
            // Generic scrape for unknown sources
            const response = await fetch(url);
            const html = await response.text();

            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            if (titleMatch) title = titleMatch[1].replace(/ - .*$/, '').trim();

            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
            if (bodyMatch) {
                fullText = bodyMatch[1]
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 5000);
            }
        }

        // Очищаем текст
        fullText = fullText
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/Читать далее.*$/gm, '')
            .replace(/Подробнее.*$/gm, '')
            .trim();

        if (fullText.length < 100) {
            return res.status(404).json({
                success: false,
                error: { code: 'CONTENT_NOT_FOUND', message: 'Could not extract full content from this source' }
            });
        }

        res.setHeader('Cache-Control', 'public, max-age=3600');

        return res.status(200).json({
            success: true,
            data: {
                title: title,
                content: fullText,
                publishedAt: publishedAt || new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('Article fetch error:', error.message);
        return res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: error.message }
        });
    }
}