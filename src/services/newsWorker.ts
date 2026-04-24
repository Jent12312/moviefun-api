import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';

const parser = new Parser();

const RSS_FEEDS = [
  { url: 'https://kanobu.ru/rss/news.xml', name: 'Kanobu' },
  { url: 'https://www.kinonews.ru/rss/', name: 'KinoNews' },
  { url: 'https://kg-portal.ru/rss/news_all.rss', name: 'KG-Portal' }
];

const SIMILARITY_THRESHOLD = 0.65;

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

function parseItem(item: any, sourceName: string) {
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
    externalId: item.guid || item.link || Math.random().toString(),
    title: item.title?.replace(/&quot;/g, '"') || "Без заголовка",
    link: item.link,
    pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    snippet: cleanSnippet,
    imageUrl,
    sourceName
  };
}

export async function fetchAndSaveNews(prisma: PrismaClient) {
  console.log('[NewsWorker] Starting news fetch...');
  
  let allArticles: any[] = [];

  const feedPromises = RSS_FEEDS.map(feed => 
    parser.parseURL(feed.url)
      .then(items => ({ items: items.items, name: feed.name }))
      .catch(e => {
        console.error(`[NewsWorker] Error loading ${feed.url}:`, e.message);
        return null;
      })
  );

  const feeds = await Promise.all(feedPromises);

  for (const feed of feeds) {
    if (!feed) continue;
    
    for (const item of feed.items) {
      allArticles.push(parseItem(item, feed.name));
    }
  }

  allArticles.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  const existingNews = await prisma.news.findMany({
    where: { pubDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { title: true }
  });

  const uniqueArticles: any[] = [];

  for (const article of allArticles) {
    let isDuplicate = false;

    for (const existing of uniqueArticles) {
      const similarity = getSimilarity(article.title, existing.title);
      if (similarity > SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      const dbDuplicate = existingNews.find(e => 
        getSimilarity(article.title, e.title) > SIMILARITY_THRESHOLD
      );
      if (!dbDuplicate) {
        uniqueArticles.push(article);
      }
    }
  }

  console.log(`[NewsWorker] Fetched ${allArticles.length} articles, ${uniqueArticles.length} unique`);

  if (uniqueArticles.length > 0) {
    await prisma.news.createMany({
      data: uniqueArticles,
      skipDuplicates: true
    });
    console.log(`[NewsWorker] Saved to database`);
  }

  await prisma.news.deleteMany({
    where: { pubDate: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
  });
}

let intervalId: NodeJS.Timeout | null = null;

export function startNewsWorker(prisma: PrismaClient, intervalMinutes = 15) {
  fetchAndSaveNews(prisma);
  
  intervalId = setInterval(() => {
    fetchAndSaveNews(prisma);
  }, intervalMinutes * 60 * 1000);

  console.log(`[NewsWorker] Started, fetching every ${intervalMinutes} minutes`);
}

export function stopNewsWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[NewsWorker] Stopped');
  }
}