import os
import json
import requests
from datetime import datetime, timedelta
from tavily import TavilyClient

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
tavily = TavilyClient(api_key=TAVILY_API_KEY)

def fetch_live_news():
    """جلب أخبار حية من مصادر جزائرية"""
    print(" جاري جلب الأخبار الحية...")
    
    headlines = []
    
    # 1. البحث في Google News عن آخر ساعة
    try:
        queries = [
            "الجزائر site:aps.dz",  # وكالة الأنباء الجزائرية
            "Algeria news last hour",
            "الجزائر أخبار اليوم",
            "Algérie actualités"
        ]
        
        for query in queries:
            response = tavily.search(
                query=query,
                search_depth="basic",
                max_results=5
            )
            
            for result in response.get('results', [])[:3]:
                headline = {
                    "title": result.get('title', ''),
                    "url": result.get('url', ''),
                    "source": "Google News",
                    "timestamp": datetime.now().isoformat()
                }
                headlines.append(headline)
    except Exception as e:
        print(f"⚠️ خطأ في جلب الأخبار: {e}")
    
    # 2. إزالة التكرار
    seen_titles = set()
    unique_headlines = []
    for h in headlines:
        if h['title'] not in seen_titles:
            seen_titles.add(h['title'])
            unique_headlines.append(h)
    
    # 3. الاحتفاظ بآخر 10
    unique_headlines = unique_headlines[:10]
    
    # 4. حفظ في JSON
    os.makedirs('public', exist_ok=True)
    with open('public/news-ticker.json', 'w', encoding='utf-8') as f:
        json.dump({
            "headlines": unique_headlines,
            "updated_at": datetime.now().strftime("%H:%M:%S"),
            "source": "APS + Google News"
        }, f, ensure_ascii=False, indent=2)
    
    print(f"✅ تم جلب {len(unique_headlines)} أخبار حية")
    return unique_headlines

if __name__ == "__main__":
    fetch_live_news()
