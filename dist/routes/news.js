"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rss_parser_1 = __importDefault(require("rss-parser"));
const cheerio = __importStar(require("cheerio"));
const client_1 = require("@prisma/client");
const parser = new rss_parser_1.default();
const prisma = new client_1.PrismaClient();
const RSS_FEEDS = [
    'https://kanobu.ru/rss/news.xml',
    'https://www.kinonews.ru/rss/',
    'https://kg-portal.ru/rss/news_all.rss'
];
function getSimilarity(str1, str2) {
    const clean1 = str1.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()«»"']/g, "");
    const clean2 = str2.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()«»"']/g, "");
    if (clean1 === clean2)
        return 1.0;
    if (clean1.length < 2 || clean2.length < 2)
        return 0.0;
    const getBigrams = (str) => {
        const bigrams = new Set();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.slice(i, i + 2));
        }
        return bigrams;
    };
    const bg1 = getBigrams(clean1);
    const bg2 = getBigrams(clean2);
    let intersection = 0;
    for (const bg of bg1) {
        if (bg2.has(bg))
            intersection++;
    }
    return (2.0 * intersection) / (bg1.size + bg2.size);
}
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const { page = 1 } = req.query;
    const pageNum = parseInt(page);
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
    }
    catch (error) {
        console.error("News Aggregator Error:", error);
        res.status(500).json({
            success: false,
            error: { code: 'NEWS_FETCH_ERROR', message: error.message }
        });
    }
});
router.get('/article', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'url is required' } });
    }
    try {
        const response = await fetch(url);
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
            const paragraphs = [];
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: error.message }
        });
    }
});
exports.default = router;
