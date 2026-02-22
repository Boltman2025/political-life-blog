import os, sys, json, datetime
from groq import Groq
from tavily import TavilyClient

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

if not GROQ_API_KEY or not TAVILY_API_KEY:
    print("❌ مفاتيح مفقودة")
    sys.exit(1)

client = Groq(api_key=GROQ_API_KEY)
tavily = TavilyClient(api_key=TAVILY_API_KEY)

def write_article(topic_num):
    topics = [
        {"title": "الاقتصاد الجزائري: نمو وتحديات", "cat": "اقتصاد"},
        {"title": "السياسة الخارجية للجزائر", "cat": "دولي"},
        {"title": "الإصلاحات الاجتماعية", "cat": "مجتمع"}
    ]
    
    topic = topics[topic_num % len(topics)]
    
    prompt = f"""
    اكتب مقالاً عن: {topic['title']}
    التصنيف: {topic['cat']}
    
    يجب أن يحتوي على:
    - مقدمة برقم مهم
    - 3-5 أرقام وإحصائيات
    - تحليل عميق
    - نقد بناء
    
    JSON فقط:
    {{
      "title": "عنوان",
      "excerpt": "ملخص",
      "content": "المقال",
      "category": "{topic['cat']}"
    }}
    """
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4
    )
    
    content = response.choices[0].message.content.replace('```json', '').replace('```', '').strip()
    
    try:
        return json.loads(content)
    except:
        return {
            "title": topic['title'],
            "excerpt": content[:200],
            "content": content,
            "category": topic['cat']
        }

def save_article(article_data, article_id):
    os.makedirs('data', exist_ok=True)
    
    try:
        with open('data/articles.json', 'r', encoding='utf-8') as f:
            articles = json.load(f)
    except:
        articles = []
    
    category = article_data.get('category', 'سياسة')
    
    # صور مضمونة 100% - روابط مباشرة
    images = {
        "اقتصاد": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop",
        "دولي": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=600&fit=crop",
        "مجتمع": "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&h=600&fit=crop",
        "سياسة": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=600&fit=crop"
    }
    
    new_article = {
        "id": article_id,
        "title": article_data.get('title', 'مقال'),
        "excerpt": article_data.get('excerpt', ''),
        "content": article_data.get('content', ''),
        "category": category,
        "author": "المحرر الآلي",
        "date": datetime.datetime.now().strftime("%d %B %Y"),
        "imageUrl": images.get(category, images["سياسة"]),
        "isBreaking": True,
        "readTime": "5 دقائق"
    }
    
    existing_ids = [a.get('id') for a in articles]
    if new_article['id'] not in existing_ids:
        articles.insert(0, new_article)
    
    articles = articles[:20]
    
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {new_article['title']} - {category}")

if __name__ == "__main__":
    print("🚀 بدء...")
    for i in range(3):
        article_id = f"{datetime.date.today()}-{i+1}"
        article = write_article(i)
        save_article(article, article_id)
    print("🎉 تم!")
