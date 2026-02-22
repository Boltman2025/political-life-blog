import os, sys, json, datetime, requests
from bs4 import BeautifulSoup
from groq import Groq
from urllib.parse import urljoin, quote
import time

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    print("❌ يجب إضافة GROQ_API_KEY في GitHub Secrets")
    sys.exit(1)

client = Groq(api_key=GROQ_API_KEY)

def fetch_aps_dz():
    """وكالة الأنباء الجزائرية - أحدث الأخبار"""
    print("📰 جلب أخبار وكالة الأنباء...")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get("https://www.aps.dz/ar", headers=headers, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        articles = []
        # استخراج الأخبار من APS
        news_items = soup.select('.actus-titre a, .news-item h3 a, .article-title a, h2 a, h3 a')
        
        for item in news_items[:8]:
            title = item.get_text().strip()
            if len(title) > 10:
                link = urljoin("https://www.aps.dz", item.get('href', ''))
                articles.append({
                    "title": title,
                    "url": link,
                    "source": "وكالة الأنباء الجزائرية",
                    "category": "سياسة",
                    "imageUrl": f"https://images.unsplash.com/photo-{int(time.time())%1000 + 1500}?w=800&h=500&fit=crop"
                })
        return articles[:3]
    except Exception as e:
        print(f"❌ خطأ APS: {e}")
        return []

def fetch_google_news_algeria():
    """Google News الجزائر - آخر ساعة"""
    print("🔍 جلب Google News الجزائر...")
    keywords = ["الجزائر", "Algerie", "Algeria"]
    articles = []
    
    for keyword in keywords:
        try:
            # RSS Google News
            url = f"https://news.google.com/rss/search?q={quote(keyword)}+when:1h&hl=ar&gl=DZ&ceid=DZ:ar"
            response = requests.get(url, timeout=10)
            soup = BeautifulSoup(response.content, 'xml')
            
            items = soup.find_all('item')[:3]
            for item in items:
                title = item.title.text.strip()
                link = item.link.text
                category = "دولي" if "دولي" in title else "اقتصاد" if "اقتصاد" in title else "مجتمع"
                
                articles.append({
                    "title": title,
                    "url": link,
                    "source": "Google News",
                    "category": category,
                    "imageUrl": f"https://source.unsplash.com/800x500/?{keyword}&sig={int(time.time())}"
                })
        except:
            continue
    
    return articles[:3]

def enhance_with_ai_summary(articles):
    """تلخيص ذكي بالـ AI"""
    print("🤖 تلخيص المقالات بالذكاء الاصطناعي...")
    
    for article in articles:
        try:
            prompt = f"""
            لديك خبر من {article['source']}:
            العنوان: {article['title']}
            
            اكتب:
            1. ملخص 1-2 جملة (50 كلمة)
            2. أهم 3 نقاط
            3. تأثير على الجزائر
            
            JSON فقط:
            {{
              "excerpt": "الملخص",
              "keyPoints": ["نقطة1", "نقطة2", "نقطة3"],
              "impact": "التأثير"
            }}
            """
            
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500
            )
            
            summary = response.choices[0].message.content.strip()
            summary = summary.replace('```json', '').replace('```', '')
            data = json.loads(summary)
            
            article.update(data)
        except:
            article["excerpt"] = f"خبر مهم: {article['title'][:100]}..."
            article["keyPoints"] = ["تفاصيل قادمة", "تحليل لاحق", "متابعة"]
            article["impact"] = "له تأثير مهم على الوضع الجزائري"
    
    return articles

def save_articles(articles):
    """حفظ في JSON"""
    os.makedirs('data', exist_ok=True)
    
    today = datetime.date.today().strftime("%Y-%m-%d")
    
    final_articles = []
    for i, article in enumerate(articles[:6]):
        article_data = {
            "id": f"{today}-{i+1}",
            "title": article['title'][:120] + "..." if len(article['title']) > 120 else article['title'],
            "excerpt": article.get('excerpt', ''),
            "content": f"""
            <h3>المصدر: {article['source']}</h3>
            <p><strong>الملخص:</strong> {article.get('excerpt', '')}</p>
            <ul>
            {''.join([f'<li>{point}</li>' for point in article.get('keyPoints', [])])}
            </ul>
            <p><strong>التأثير:</strong> {article.get('impact', '')}</p>
            <p><a href="{article['url']}" target="_blank">اقرأ المقال كاملاً</a></p>
            """,
            "category": article.get('category', 'سياسة'),
            "author": article['source'],
            "date": datetime.datetime.now().strftime("%d %B %Y - %H:%M"),
            "imageUrl": article['imageUrl'],
            "isBreaking": i < 2,
            "readTime": "3 دقائق",
            "url": article['url'],
            "keyPoints": article.get('keyPoints', []),
            "impact": article.get('impact', '')
        }
        final_articles.append(article_data)
    
    # حفظ
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(final_articles, f, ensure_ascii=False, indent=2)
    
    print(f"✅ تم حفظ {len(final_articles)} خبر حي!")

if __name__ == "__main__":
    print("🚨 نظام نقل الأخبار الجزائرية الحي بدء العمل...")
    
    # جلب الأخبار
    aps_articles = fetch_aps_dz()
    google_articles = fetch_google_news_algeria()
    
    all_articles = aps_articles + google_articles
    
    if all_articles:
        # تحسين بالـ AI
        enhanced_articles = enhance_with_ai_summary(all_articles)
        save_articles(enhanced_articles)
        print("🎉 تم! الأخبار الحية محفوظة في data/articles.json")
    else:
        print("❌ فشل جلب الأخبار - تحقق من الإنترنت")
        sys.exit(1)
