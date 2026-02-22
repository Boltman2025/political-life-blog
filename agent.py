import os, sys, json, datetime, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time, re

def extract_image_from_url(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get(url, headers=headers, timeout=8)
        soup = BeautifulSoup(resp.content, 'html.parser')
        img = soup.select_one('img[src*="aps.dz"], .article-image img, figure img, .news-img img')
        if img and img.get('src'):
            return urljoin(url, img['src'])
    except:
        pass
    return f"https://images.unsplash.com/photo-{int(time.time())%10000}?w=800&fit=crop&algeria"

def fetch_aps_breaking():
    print("🚨 شريط الأخبار - APS...")
    articles = []
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get("https://www.aps.dz/ar", headers=headers, timeout=12)
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        items = soup.select('.actus-titre a, h2 a, h3 a, .news-title a, .article-title a')[:6]
        for item in items:
            title = item.get_text().strip()
            if len(title) > 15:
                link = urljoin("https://www.aps.dz", item.get('href', ''))
                img = extract_image_from_url(link)
                articles.append({
                    "title": title[:140],
                    "url": link,
                    "source": "وكالة الأنباء الجزائرية",
                    "category": "عاجل",
                    "imageUrl": img
                })
        print(f"✅ APS: {len(articles)} خبر")
    except Exception as e:
        print(f"❌ APS خطأ: {e}")
    return articles

def fetch_google_breaking():
    print("🔥 Google News عاجل...")
    articles = []  # ✅ إصلاح الخطأ هنا!
    try:
        url = "https://news.google.com/rss/search?q=الجزائر+عاجل+when:2h&hl=ar&gl=DZ&ceid=DZ:ar"
        resp = requests.get(url, timeout=10)
        soup = BeautifulSoup(resp.content, 'xml')
        
        items = soup.find_all('item')[:4]
        for item in items:
            title = item.title.text.strip()
            articles.append({  # ✅ حفظ في articles المحلية
                "title": title[:140],
                "url": item.link.text,
                "source": "Google News",
                "category": "عاجل", 
                "imageUrl": f"https://images.unsplash.com/photo-{int(time.time())}?news&w=800"
            })
        print(f"✅ Google: {len(articles)} خبر")
    except Exception as e:
        print(f"❌ Google خطأ: {e}")
    return articles  # ✅ إرجاع articles المحلية

def main():
    print("🚨 شريط الأخبار الجزائري الحي - بدء...")
    
    # جلب الشريط
    aps_articles = fetch_aps_breaking()
    google_articles = fetch_google_breaking()
    
    breaking = aps_articles + google_articles
    
    if not breaking:
        print("❌ لا أخبار - إنشاء تجريبية")
        breaking = [{
            "title": "نظام شريط الأخبار يعمل بنجاح! 🚀",
            "url": "https://www.aps.dz",
            "source": "النظام",
            "category": "نظام",
            "imageUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
        }]
    
    # حفظ شريط JSON
    data = []
    for i, art in enumerate(breaking[:10]):
        data.append({
            "id": f"live-{int(time.time())}-{i}",
            "title": art['title'],
            "excerpt": f"📰 {art['source']} | عاجل",
            "content": f'<div class="text-xl"><strong>{art["source"]}</strong><br><a href="{art["url"]}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded">الكامل →</a></div>',
            "category": art.get('category', 'عاجل'),
            "author": art['source'],
            "date": datetime.datetime.now().strftime("%d/%m %H:%M"),
            "imageUrl": art['imageUrl'],
            "isBreaking": True,
            "readTime": "1 دقيقة",
            "url": art['url'],
            "keyPoints": [art['title'][:100]],
            "impact": "خبر عاجل للمتابعة"
        })
    
    os.makedirs('data', exist_ok=True)
    with open('data/live.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ ✅ شريط محفوظ: {len(data)} خبر عاجل!")
    print("🌐 جاهز للنشر على الموقع!")

if __name__ == "__main__":
    main()
