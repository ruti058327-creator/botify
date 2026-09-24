import sys
import traceback
import io
from playwright.sync_api import sync_playwright

# הגדרת קידוד הטרמינל ל-UTF-8 למניעת שגיאות תווים מיוחדים ואימוג'ים
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def scrape_website(url):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            )

            page.goto(url, timeout=30000, wait_until='domcontentloaded')
            page.wait_for_timeout(3000)

            clean_text = page.evaluate("document.body.innerText")
            browser.close()

            clean_text = ' '.join(clean_text.split())
            return clean_text

    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        result = scrape_website(target_url)
        if result and len(result.strip()) > 50:
            print(result[:15000])
        else:
            print("Error: Scraped text is empty or too short", file=sys.stderr)
            sys.exit(1)
    else:
        print("Error: No URL provided", file=sys.stderr)
        sys.exit(1)