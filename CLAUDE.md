# 房地產交易視覺化系統 - 開發文檔

本文檔包含所有開發相關的詳細資訊，適合開發者和資料處理人員使用。

## 目錄

1. [CSV 資料格式規格](#csv-資料格式規格)
2. [資料載入方式](#資料載入方式)
3. [在視覺化中使用資料](#在視覺化中使用資料)
4. [效能優化建議](#效能優化建議)
5. [常見問題](#常見問題)
6. [完整範例流程](#完整範例流程)

---

## CSV 資料格式規格

### 必要欄位

以下欄位為**必要**，缺少任一欄位將無法正常顯示：

| 欄位名稱 | 英文欄位名 | 資料型態 | 說明 | 範例值 |
|---------|-----------|---------|------|--------|
| 經度 | longitude, lng, lon | 浮點數 | WGS84 座標系統 | 121.5435 |
| 緯度 | latitude, lat | 浮點數 | WGS84 座標系統 | 25.0267 |
| 單價 | price, unit_price, 單價元平方公尺 | 數值 | 每坪單價（元） | 850000 |
| 交易年月 | yearMonth, year_month, 交易年月 | 文字 | YYYY-MM 或民國年 | 2023-01 或 112年01月 |

### 選用欄位

以下欄位為**選用**，有助於資料分析但非必要：

| 欄位名稱 | 英文欄位名 | 資料型態 | 說明 | 範例值 |
|---------|-----------|---------|------|--------|
| 坪數 | area, 建物移轉總面積坪 | 數值 | 建物面積（坪） | 28.5 |
| 地址 | address, 交易標的 | 文字 | 完整或部分地址 | 台北市大安區復興南路一段 |
| 建物型態 | buildingType, 建物型態 | 文字 | 建築類型 | 住宅大樓(11層含以上有電梯) |
| 總價 | totalPrice, 總價元 | 數值 | 交易總價（元） | 24225000 |

### 欄位名稱彈性

系統會自動辨識以下欄位名稱（不分大小寫）：

- **經度**：`longitude`, `lng`, `lon`, `經度`
- **緯度**：`latitude`, `lat`, `緯度`
- **單價**：`price`, `unit_price`, `unitPrice`, `單價`, `單價元平方公尺`
- **交易年月**：`yearMonth`, `year_month`, `date`, `交易年月`, `交易年月日`
- **坪數**：`area`, `建物移轉總面積坪`, `土地移轉總面積坪`
- **地址**：`address`, `交易標的`, `土地位置建物門牌`
- **建物型態**：`buildingType`, `building_type`, `建物型態`
- **總價**：`totalPrice`, `total_price`, `總價元`, `交易價格`

### 資料格式要求

#### 經緯度格式
- **座標系統**：WGS84（Google Maps / OpenStreetMap 標準）
- **格式**：十進位度數（Decimal Degrees）
- **精度**：建議至少 4 位小數（約 11 公尺精度）
- **台灣範圍**：經度 120-122，緯度 22-25

```
✅ 正確：121.5435, 25.0267
❌ 錯誤：121°32'36.6"E, 25°1'36.1"N  ← 度分秒格式需轉換
❌ 錯誤：TWD97 座標（X=250000, Y=2750000）← 需轉換為 WGS84
```

#### 交易年月格式

支援以下格式（會自動轉換）：

| 格式 | 範例 | 說明 |
|-----|------|------|
| YYYY-MM | 2023-01 | 西元年月（推薦） |
| YYYY/MM | 2023/01 | 西元年月（斜線） |
| 民國年格式 | 112年01月 | 自動轉換為 2023-01 |
| 民國年緊湊 | 11201 | 自動轉換為 2023-01 |

**推薦**：直接使用 `YYYY-MM` 格式

#### 單價格式
- **單位**：元/坪（每坪單價）
- **格式**：純數字，不含逗號或貨幣符號
- **合理範圍**：台北市 20萬-200萬/坪

```
✅ 正確：850000
❌ 錯誤：850,000 或 $850000 或 85萬
```

**單位轉換**：如果你的資料是「元/平方公尺」
```
元/坪 = 元/m² × 3.30579
```

#### 數值欄位通用規則
- 不可包含逗號：`850000`（O）、`850,000`（X）
- 不可包含單位符號：`28.5`（O）、`28.5坪`（X）
- 小數點使用 `.` 而非 `,`：`28.5`（O）、`28,5`（X）

### CSV 檔案格式要求

- **編碼**：UTF-8（推薦），也支援 UTF-8 with BOM、Big5
- **分隔符號**：逗號 `,`
- **標題列**：必須包含（第一行為欄位名稱）
- **換行符號**：Windows (CRLF) 或 Unix/Mac (LF) 皆可

### 推薦的 CSV 格式

**完整版**（包含所有欄位）：
```csv
longitude,latitude,price,yearMonth,area,address,buildingType,totalPrice
121.5435,25.0267,850000,2023-01,28.5,台北市大安區復興南路一段,住宅大樓(11層含以上有電梯),24225000
121.5654,25.0330,720000,2023-01,32.0,台北市信義區松仁路,華廈(10層含以下有電梯),23040000
121.5177,25.0329,650000,2023-02,25.0,台北市中正區羅斯福路一段,住宅大樓(11層含以上有電梯),16250000
```

**最精簡版**（僅必要欄位）：
```csv
longitude,latitude,price,yearMonth
121.5435,25.0267,850000,2023-01
121.5654,25.0330,720000,2023-01
121.5177,25.0329,650000,2023-02
```

**中文欄位名稱**（也支援）：
```csv
經度,緯度,單價,交易年月,坪數,地址,建物型態
121.5435,25.0267,850000,2023-01,28.5,台北市大安區復興南路一段,住宅大樓(11層含以上有電梯)
121.5654,25.0330,720000,2023-01,32.0,台北市信義區松仁路,華廈(10層含以下有電梯)
```

### 常見錯誤與解決

**錯誤 1：經緯度順序顛倒**
```
❌ 錯誤：latitude,longitude (緯度在前)
✅ 正確：longitude,latitude (經度在前)
```

**錯誤 2：座標系統錯誤**
- 如果你的座標是 TWD97，需要轉換為 WGS84
- 可使用線上轉換工具或 Python pyproj 套件

**錯誤 3：單價單位錯誤**
- 確認單位是「元/坪」而非「元/平方公尺」
- 使用轉換公式：元/坪 = 元/m² × 3.30579

**錯誤 4：日期格式問題**
```
❌ 2023/1/5（包含日期）
✅ 2023-01（只要年月）
```

### 資料品質建議

**單價合理範圍**：
- 台北市：20 萬 ~ 200 萬/坪
- 新北市：15 萬 ~ 150 萬/坪
- 其他縣市：10 萬 ~ 100 萬/坪

**經緯度有效範圍**：
- 台灣本島經度：119.5 ~ 122.0
- 台灣本島緯度：21.5 ~ 25.5

**缺失值處理**：
- 經緯度、單價、年月缺失 → 跳過該筆資料
- 坪數、地址、建物型態缺失 → 仍可顯示，但統計受限

### 檔案大小建議

| 資料筆數 | 檔案大小（約） | 建議處理方式 |
|---------|--------------|-------------|
| < 1 萬筆 | < 1 MB | 直接使用 CSV |
| 1-10 萬筆 | 1-10 MB | 轉換為 JSON 後使用 |
| 10-50 萬筆 | 10-50 MB | 分割檔案或使用資料庫 |
| > 50 萬筆 | > 50 MB | 建議使用資料庫 + API |

---

## 資料載入方式

本系統支援三種資料來源：AWS S3、本地 CSV 檔案、資料庫。

### 標準 JSON 格式

視覺化系統最終接受以下格式：

```json
[
  {
    "position": [121.5435, 25.0267],
    "price": 850000,
    "yearMonth": "2023-01",
    "area": 28.5,
    "address": "台北市大安區復興南路一段",
    "buildingType": "住宅大樓(11層含以上有電梯)",
    "totalPrice": 24225000
  }
]
```

參考範例檔案：`data-format-example.json`、`sample-data.csv`

### 方式 1：從 AWS S3 載入

**適合情境**：
- 資料已上傳至 S3
- 需要多人共用資料
- 資料量大，不適合放在 git

**使用方式**：
```bash
# JSON 格式
node data-loader.js s3 https://your-bucket.s3.ap-northeast-1.amazonaws.com/real-estate-data.json

# CSV 格式
node data-loader.js s3 https://your-bucket.s3.ap-northeast-1.amazonaws.com/real-estate-data.csv
```

**程式碼範例**：
```javascript
import { loadFromS3, saveProcessedData } from './data-loader.js';

const data = await loadFromS3(
  'https://your-bucket.s3.region.amazonaws.com/data.json',
  {
    format: 'json',        // 'json' 或 'csv'
    minPrice: 200000,      // 最低單價篩選
    maxPrice: 1500000,     // 最高單價篩選
    buildingTypes: ['住宅大樓(11層含以上有電梯)']
  }
);

saveProcessedData(data, './real-data.json');
```

**S3 權限設定**：
- 確保 S3 物件有公開讀取權限，或使用 Presigned URL
- 如果前端直接從 S3 載入，需設定 CORS policy

**S3 CORS 設定範例**：
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### 方式 2：從本地 CSV 載入

**適合情境**：
- 從內政部實價登錄下載的 CSV
- 本地測試開發
- 一次性資料處理

**使用方式**：
```bash
node data-loader.js csv ./your-data.csv
```

**程式碼範例**：
```javascript
import { loadFromCSV, saveProcessedData } from './data-loader.js';

const data = await loadFromCSV('./your-data.csv', {
  minPrice: 200000,
  maxPrice: 1500000,
  buildingTypes: [
    '住宅大樓(11層含以上有電梯)',
    '華廈(10層含以下有電梯)'
  ],
  // 自訂欄位對應（如果 CSV 欄位名稱不同）
  fieldMapping: {
    yearMonth: ['交易年月'],
    price: ['單價元平方公尺'],
    latitude: ['緯度'],
    longitude: ['經度']
  }
});

saveProcessedData(data, './real-data.json');
```

### 方式 3：從資料庫載入

**適合情境**：
- 資料量超過 10 萬筆
- 需要定期更新資料
- 有後端系統整合需求

**安裝資料庫驅動**：
```bash
# PostgreSQL
npm install pg

# MySQL
npm install mysql2

# MongoDB
npm install mongodb
```

**設定環境變數**：
```bash
# 建立 .env 檔案
cp .env.example .env

# 編輯 .env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=real_estate
DB_USER=your_username
DB_PASSWORD=your_password
```

**使用方式**：
```bash
node data-loader.js db
```

**PostgreSQL 程式碼範例**：
```javascript
import { loadFromDatabase, saveProcessedData } from './data-loader.js';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'real_estate',
  user: 'postgres',
  password: 'password'
};

const query = `
  SELECT
    longitude,
    latitude,
    unit_price,
    year_month,
    area,
    address,
    building_type,
    total_price
  FROM real_estate_transactions
  WHERE
    unit_price BETWEEN 200000 AND 1500000
    AND transaction_date >= '2023-01-01'
  ORDER BY year_month
`;

const data = await loadFromDatabase(dbConfig, query, {
  minPrice: 200000,
  maxPrice: 1500000
});

saveProcessedData(data, './real-data.json');
```

**資料庫表格結構建議**：
```sql
CREATE TABLE real_estate_transactions (
  id SERIAL PRIMARY KEY,
  longitude DECIMAL(10, 6) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  year_month VARCHAR(7) NOT NULL,      -- 格式：'2023-01'
  transaction_date DATE,
  area DECIMAL(10, 2),
  address TEXT,
  building_type VARCHAR(100),
  total_price DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_year_month ON real_estate_transactions(year_month);
CREATE INDEX idx_location ON real_estate_transactions(longitude, latitude);
```

### 資料處理選項

**價格篩選**：
```javascript
{
  minPrice: 200000,    // 最低單價（元/坪）
  maxPrice: 1500000,   // 最高單價（元/坪）
}
```

**建物類型篩選**：
```javascript
{
  buildingTypes: [
    '住宅大樓(11層含以上有電梯)',
    '華廈(10層含以下有電梯)',
    '公寓(5樓含以下無電梯)',
    '透天厝'
  ]
}
```

**自訂欄位對應**（CSV）：
```javascript
{
  fieldMapping: {
    yearMonth: ['交易年月', 'date'],
    price: ['單價', 'unit_price'],
    latitude: ['緯度', 'lat'],
    longitude: ['經度', 'lng']
  }
}
```

---

## 在視覺化中使用資料

### 方法 A：動態載入 JSON（推薦）

適合資料量中等、需要從遠端載入的情況。

修改 `real-estate-viz.jsx`：

```javascript
import React, { useState, useMemo, useEffect } from 'react';
// ... 其他 imports

const RealEstateVisualization = () => {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 載入真實資料
  useEffect(() => {
    // 可以從本地或 S3 載入
    fetch('/real-data.json')  // 或 'https://your-bucket.s3...'
      .then(res => res.json())
      .then(data => {
        setAllData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('載入資料失敗:', err);
        setLoading(false);
      });
  }, []);

  // 其餘程式碼保持不變
  const allMonths = useMemo(() => {
    const months = [...new Set(allData.map(d => d.yearMonth))].sort();
    return months;
  }, [allData]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-white">載入資料中...</div>
    </div>;
  }

  // ... 其餘組件程式碼不變
};
```

### 方法 B：直接 import（適合小資料集）

適合資料量小（< 1 萬筆）、不常變動的情況。

```javascript
import realData from './real-data.json';

const RealEstateVisualization = () => {
  const allData = useMemo(() => realData, []);

  // 移除 useState 和 useEffect
  // 其餘程式碼保持不變
};
```

### 方法 C：分批載入（適合大資料集）

適合資料量大（> 10 萬筆）的情況。

```javascript
const RealEstateVisualization = () => {
  const [allData, setAllData] = useState([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    // 只載入當前需要的時間範圍
    const currentMonth = allMonths[currentMonthIndex];
    const startMonth = allMonths[Math.max(0, currentMonthIndex - 2)];
    const endMonth = allMonths[Math.min(allMonths.length - 1, currentMonthIndex + 2)];

    fetch(`/api/transactions?start=${startMonth}&end=${endMonth}`)
      .then(res => res.json())
      .then(data => setAllData(data));
  }, [currentMonthIndex]);

  // ... 其餘程式碼
};
```

---

## 效能優化建議

### 資料量大時（> 10 萬筆）

#### 1. 資料分割
按年度或季度分割檔案：
```
real-data-2023-Q1.json
real-data-2023-Q2.json
real-data-2023-Q3.json
real-data-2023-Q4.json
```

動態載入：
```javascript
const loadDataByQuarter = async (year, quarter) => {
  const data = await fetch(`/data/${year}-Q${quarter}.json`);
  return data.json();
};
```

#### 2. 使用後端 API
只載入當前顯示月份前後的資料：
```javascript
const loadDataByTimeRange = async (startMonth, endMonth) => {
  const response = await fetch(
    `/api/transactions?start=${startMonth}&end=${endMonth}`
  );
  return response.json();
};
```

#### 3. 資料壓縮
使用 gzip 壓縮 JSON 檔案，可減少 70-80% 檔案大小。

#### 4. 考慮使用資料庫
- 前端透過 API 查詢需要的資料
- 支援分頁、篩選、聚合查詢
- 更新資料更方便

### 資料品質檢查

處理資料後，建議檢查：
```bash
node -e "
const data = require('./real-data.json');
console.log('總筆數:', data.length);
console.log('價格範圍:', Math.min(...data.map(d => d.price)), '~', Math.max(...data.map(d => d.price)));
console.log('時間範圍:', data[0].yearMonth, '~', data[data.length-1].yearMonth);
console.log('缺少地址:', data.filter(d => !d.address).length);
console.log('平均單價:', (data.reduce((sum, d) => sum + d.price, 0) / data.length).toFixed(0));
"
```

---

## 常見問題

### Q1: CSV 沒有經緯度怎麼辦？

實價登錄資料通常沒有經緯度，需要使用地理編碼服務：

**選項 1：Google Maps Geocoding API**
- 每月免費 $200 額度（約 28,000 次查詢）
- 申請：https://console.cloud.google.com/

**選項 2：HERE Geocoding API**
- 每月免費 1,000 次查詢
- 申請：https://developer.here.com/

**選項 3：台灣地址定位服務**
- 政府提供的免費服務（有速率限制）

**實作範例**（參考 `data-processor.js`）：
```javascript
async function geocodeAddress(address) {
  const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.results && data.results[0]) {
    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng
    };
  }
  throw new Error('Geocoding failed');
}
```

**注意事項**：
- 實價登錄地址有去識別化（例如：大安區復興南路 2~30 號）
- 大量地理編碼需要付費 API 或處理速率限制
- 建議預先處理並快取結果

### Q2: 資料太大，前端載入很慢？

建議：
1. 使用資料庫 + 後端 API（最佳方案）
2. 實作資料分頁或時間範圍篩選
3. 壓縮 JSON（gzip），可減少 70-80% 大小
4. 考慮使用 Parquet 等二進位格式
5. 按季度或年度分割檔案

### Q3: 如何從 S3 載入資料？

確保：
1. S3 物件有公開讀取權限，或使用 Presigned URL
2. 設定 CORS policy（見上方範例）
3. 使用正確的 S3 URL 格式

### Q4: 如何自動化資料更新？

可以設定：
1. 定期從政府開放資料平台 API 抓取
2. 使用 cron job 定期處理新資料
3. 整合 CI/CD pipeline 自動部署

**範例 cron job**：
```bash
# 每週一凌晨 2 點更新資料
0 2 * * 1 cd /path/to/project && node data-loader.js csv /path/to/new-data.csv
```

### Q5: 座標系統是 TWD97 怎麼辦？

需要轉換為 WGS84。可使用：

**Python (pyproj)**：
```python
from pyproj import Transformer

transformer = Transformer.from_crs("EPSG:3826", "EPSG:4326")
lat, lng = transformer.transform(x_twd97, y_twd97)
```

**線上轉換工具**：
- https://epsg.io/transform

### Q6: 如何處理民國年轉西元年？

系統已內建自動轉換（見 `data-processor.js`）：
- `112年01月` → `2023-01`
- `11201` → `2023-01`

如果你的 CSV 是民國年格式，不需要手動處理。

---

## 完整範例流程

### 範例 1：從 CSV 到顯示（已有經緯度）

```bash
# 1. 下載實價登錄 CSV（或準備好你的 CSV）
# 確認 CSV 包含：經度、緯度、單價、交易年月

# 2. 處理 CSV
node data-loader.js csv ./your-data.csv

# 3. 檢查處理結果
cat real-data.json | head -n 20

# 4. 修改 real-estate-viz.jsx 使用真實資料
# （使用「方法 A：動態載入 JSON」）

# 5. 啟動開發伺服器
npm run dev

# 6. 訪問 http://localhost:3000
```

### 範例 2：從 S3 載入

```bash
# 1. 上傳 JSON 或 CSV 到 S3

# 2. 設定 S3 CORS policy

# 3. 取得 S3 URL
S3_URL="https://your-bucket.s3.ap-northeast-1.amazonaws.com/data.json"

# 4. 處理資料（可選，或直接在前端載入）
node data-loader.js s3 $S3_URL

# 5. 修改 real-estate-viz.jsx
# fetch('https://your-bucket.s3...')

# 6. 啟動開發伺服器
npm run dev
```

### 範例 3：使用資料庫

```bash
# 1. 建立資料庫表格（見上方 SQL）

# 2. 匯入資料到資料庫
psql -U postgres -d real_estate -f import-data.sql

# 3. 設定環境變數
echo "DB_HOST=localhost" > .env
echo "DB_NAME=real_estate" >> .env

# 4. 從資料庫載入資料
node data-loader.js db

# 5. 啟動開發伺服器
npm run dev
```

---

## 推薦流程（由易到難）

1. **第一步：測試環境**
   ```bash
   # 使用範例資料測試系統
   node data-processor.js
   # 會產生 sample-data.json
   ```

2. **第二步：小規模真實資料**
   - 準備 100-1000 筆資料的 CSV
   - 確認包含經緯度
   ```bash
   node data-loader.js csv ./small-sample.csv
   ```

3. **第三步：完整資料集**
   - 處理完整的資料（1 萬 ~ 10 萬筆）
   - 如果沒有經緯度，需先進行地理編碼

4. **第四步：大規模資料（選用）**
   - 考慮使用資料庫儲存
   - 實作後端 API
   - 前端動態載入

---

## 相關檔案

- `data-format-example.json` - 標準資料格式範例
- `sample-data.csv` - CSV 格式範例
- `data-loader.js` - 多來源資料載入工具
- `data-processor.js` - CSV 處理工具（含地理編碼介面）
- `real-estate-viz.jsx` - 視覺化主組件

---

## 技術堆疊

- **React** 18 - UI 框架
- **Deck.gl** 9 - WebGL 視覺化引擎
- **react-map-gl** 7 - Mapbox GL 的 React wrapper
- **Vite** 5 - 建置工具
- **Tailwind CSS** - 樣式框架
- **D3 Scale** - 資料縮放工具
- **csv-parse** - CSV 解析工具

---

## 視覺化自訂設定

### 調整網格大小
修改 `real-estate-viz.jsx`:
```javascript
cellSize: 100,  // 改為 50 (50公尺) 或 200 (200公尺)
```

### 調整顏色範圍
```javascript
const colorScale = scaleLinear()
  .domain([300000, 500000, 700000, 900000])  // 調整價格區間
  .range([
    [65, 182, 196],   // 低價 - 藍色
    [127, 205, 187],  // 中低價 - 青色
    [253, 180, 98],   // 中高價 - 橙色
    [214, 96, 77]     // 高價 - 紅色
  ]);
```

### 切換 2D/3D 模式
```javascript
// 2D 模式（目前設定）
pitch: 0,
extruded: false,
elevationScale: 0,

// 3D 模式
pitch: 45,
extruded: true,
elevationScale: 20,
```

---

需要協助請參考 [README.md](./README.md) 或提出 issue。
