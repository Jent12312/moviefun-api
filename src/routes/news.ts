import { Router, Request, Response } from 'express';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const parser = new Parser();
const prisma = new PrismaClient();

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
    const limit = 20;
    const startIndex = (pageNum - 1) * limit;

    const [articles, total] = await Promise.all([
      prisma.news.findMany({
        orderBy: { pubDate: 'desc' },
        skip: startIndex,
        take: limit
      }),
      prisma.news.count()
    ]);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.json({
      success: true,
      data: articles,
      meta: { page: pageNum, total_results: total }
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
    const $ = cheerio.load(html);

    let articleTitle = $('title').text().split('-')[0].split('|')[0].trim();
    if (!articleTitle) {
      articleTitle = $('h1').first().text().trim();
    }

    let content = '';

    const articleSelectors = [
      'article',
      '[class*="article-content"]',
      '[class*="article-body"]',
      '[id*="article"]',
      '.post-content',
      '.entry-content',
      '.news-content',
      'main'
    ];

    for (const selector of articleSelectors) {
      const el = $(selector).first();
      if (el.length && el.text().length > 100) {
        content = el.text();
        break;
      }
    }

    if (!content || content.length < 100) {
      const paragraphs: string[] = [];
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          paragraphs.push(text);
        }
      });
      content = paragraphs.join('\n\n');
    }

    content = content
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/Читать далее.*$/gi, '')
      .replace(/Подробнее.*$/gi, '')
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