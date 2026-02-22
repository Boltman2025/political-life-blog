import os, sys, json, datetime, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote
import time, re

def extract_image_from_url(url):
    """استخراج صورة حقيقية من صفحة الخبر"""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # APS images
        img = soup.select_one('img[src*="aps.dz"], .article-image img, .news-image img, figure img')
        if img and img.get('src'):
            return urljoin(url, img['src'])
        
        # Google News fallback
        img = soup.find('img', {'width': re.compile(r'\d+')})
        if img:
            return img['src']
    except:
        pass
    return f"https://images.unsplash.com/photo-{int(time.time())%5000}?w=800&fit=crop"

def fetch_aps_breaking():
    """شريط الأخبار الفورية - APS"""
    print("🚨 شريط الأخبار الفورية...")
    articles = []
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get("https://www.aps.dz/ar", headers=headers, timeout=15)
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # العاجل والأهم
        items = soup.select('.actus-titre a, .breaking a, h2 a, h3 a, .news-title a')[:6]
        for item in items:
            title = item.get_text().strip()
            if len(title) > 15:
                link = urljoin("https://www.aps.dz", item.get('href', ''))
                img = extract_image_from_url(link)
                articles.append({
                    "title": title[:150],
                    "url": link,
                    "source": "وكالة الأنباء الجزائرية",
                    "category": "عاجل",
                    "imageUrl": img,
                    "isBreaking": True
                })
    except Exception as e:
        print(f"❌ APS: {e}")
    return articles

def fetch_google_breaking():
    """Google News عاجل"""
    print("🔥 Google News عاجل...")
    try:
        url = "https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%AC%D8%B2%D8%A7%D8%A6%D8%B1+%D8%B9%D8%A7%D8%AC%D9%84+when:1h&hl=ar&gl=DZ&ceid=DZ:ar"
        resp = requests.get(url, timeout=10)
        soup = BeautifulSoup(resp.content, 'xml')
        
        items = soup.find_all('item')[:4]
        for item in items:
            title = item.title.text.strip()
            articles.append({
                "title": title[:150],
                "url": item.link.text,
                "source": "Google News",
                "category": "عاجل",
                "imageUrl": f"https://images.unsplash.com/photo-{int(time.time())}?algeria&w=800",
                "isBreaking": True
            })
    except:
        pass
    return articles

def main():
    print("🚨 شريط الأخبار الجزائري الحي!")
    
    breaking = fetch_aps_breaking() + fetch_google_breaking()
    
    data = []
    for i, art in enumerate(breaking[:8]):
        data.append({
            "id": f"live-{int(time.time())}-{i}",
            "title": art['title'],
            "excerpt": f"📰 {art['source']} | عاجل",
            "content": f'<a href="{art["url"]}" target="_blank">الكامل</a>',
            "category": "عاجل",
            "author": art['source'],
            "date": datetime.datetime.now().strftime("%H:%M"),
            "imageUrl": art['imageUrl'],
            "isBreaking": True,
            "readTime": "1 دقيقة",
            "url": art['url'],
            "keyPoints": [art['title'][:80]],
            "impact": "خبر عاجل"
        })
    
    os.makedirs('data', exist_ok=True)
    with open('data/live.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {len(data)} خبر عاجل محفوظ!")

if __name__ == "__main__":
    main()
