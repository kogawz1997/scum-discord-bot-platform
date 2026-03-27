# SCUM Items API

Programmatic access to SCUM game item images hosted on GitHub Pages.

## Endpoints

### Get All Items (JSON)
```
GET https://vbothost.github.io/scum_items/index.json
```
Returns complete index of all items in JSON format.

### Get All Items (CSV)
```
GET https://vbothost.github.io/scum_items/items.csv
```
Returns complete index in CSV format.

### Get All Items (Text)
```
GET https://vbothost.github.io/scum_items/items.txt
```
Returns pipe-delimited text format.

### Get Individual Item
```
GET https://vbothost.github.io/scum_items/{filename}.webp
```
Replace `{filename}` with the exact filename (including .webp extension).

## Response Format (JSON)

```json
{
  "repository": {
    "name": "scum_items",
    "description": "SCUM game item images collection",
    "base_url": "https://vbothost.github.io/scum_items/",
    "total_items": 2094,
    "last_updated": "2025-09-10",
    "format": "webp"
  },
  "items": [
    {
      "filename": "05_Teeth_Necklace.webp",
      "name": "05_Teeth_Necklace",
      "url": "https://vbothost.github.io/scum_items/05_Teeth_Necklace.webp"
    }
  ]
}
```

## Usage Examples

### JavaScript
```javascript
fetch('https://vbothost.github.io/scum_items/index.json')
  .then(response => response.json())
  .then(data => {
    console.log(`Found ${data.repository.total_items} items`);
    data.items.forEach(item => {
      console.log(`${item.name}: ${item.url}`);
    });
  });
```

### Python
```python
import requests

response = requests.get('https://vbothost.github.io/scum_items/index.json')
data = response.json()

print(f"Found {data['repository']['total_items']} items")
for item in data['items']:
    print(f"{item['name']}: {item['url']}")
```

### curl
```bash
curl -s https://vbothost.github.io/scum_items/index.json | jq '.repository.total_items'
```

## Notes
- All images are in WebP format
- Base URL: `https://vbothost.github.io/scum_items/`
- Total items: 2094
- Updated: 2025-09-10