import { Router, Request, Response } from 'express';
import Parser from 'rss-parser';

const parser = new Parser();

const RSS_FEEDS = [
  'https://kanobu.ru/rss/news.xml',
  'https://www.kinonews.ru/rss/',
  'https://kg-portal.ru/rss/news_all.rss'
];

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

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { page = 1 } = req.query;
  const pageNum = parseInt(page as string);

  try {
    let allArticles: any[] = [];

    const feedPromises = RSS_FEEDS.map(url => parser.parseURL(url).catch(e => {
      console.error(`Error loading ${url}:`, e.message);
      return null;
    }));

    const feeds = await Promise.all(feedPromises);

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
          imageUrl,
          sourceName: feed.title || "Новости"
        };
      });

      allArticles = allArticles.concat(items);
    }

    allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

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

    const limit = 20;
    const startIndex = (pageNum - 1) * limit;
    const paginatedArticles = uniqueArticles.slice(startIndex, startIndex + limit);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.json({
      success: true,
      data: paginatedArticles,
      meta: { page: pageNum, total_results: uniqueArticles.length }
    });

  } catch (error: any) {
    console.error("News Aggregator Error:", error);
    res.status(500).json({
      success: false,
      error: { code: 'NEWS_FETCH_ERROR', message: error.message }
    });
  }
});

router.get('/article', async (req: Request, res: Response) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'url is required' } });
  }

  try {
    const response = await fetch(url as string);
    const html = await response.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const articleTitle = titleMatch ? titleMatch[1].replace(/ - .*$/, '').trim() : '';

    let content = '';
    const contentPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/,
      /<div[^>]*class="[^"]*article[\s\S]*?<\/div>/,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/,
      /<main[^>]*>([\s\S]*?)<\/main>/
    ];

    for (const pattern of contentPatterns) {
      const match = html.match(pattern);
      if (match) {
        content = match[1].replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        break;
      }
    }

    if (!content) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      if (bodyMatch) {
        content = bodyMatch[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/g, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    content = content
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/Читать далее.*$/gm, '')
      .replace(/Подробнее.*$/gm, '')
      .trim();

    if (content.length > 5000) {
      content = content.substring(0, 5000) + '...';
    }

    if (content.length < 100) {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTENT_NOT_FOUND', message: 'Could not extract article content' }
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: { title: articleTitle, content, url }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

export default router;