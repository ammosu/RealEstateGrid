import React, { useState, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GridLayer } from '@deck.gl/aggregation-layers';
import { Map } from 'react-map-gl';
import { scaleLinear } from 'd3-scale';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

// 模擬資料產生器
const generateMockData = () => {
  const data = [];
  const startDate = new Date('2023-01-01');
  const endDate = new Date('2024-12-01');
  
  // 台北市中心附近的範圍
  const centerLat = 25.0330;
  const centerLon = 121.5654;
  
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    // 每個月產生 200-300 筆交易
    const numTransactions = Math.floor(Math.random() * 100) + 200;
    
    for (let i = 0; i < numTransactions; i++) {
      // 在中心點周圍隨機分布
      const lat = centerLat + (Math.random() - 0.5) * 0.1;
      const lon = centerLon + (Math.random() - 0.5) * 0.1;
      
      // 價格隨時間略有上升趨勢
      const monthsSinceStart = (d - startDate) / (1000 * 60 * 60 * 24 * 30);
      const basePrice = 600000 + monthsSinceStart * 5000;
      const price = basePrice + (Math.random() - 0.5) * 200000;
      
      data.push({
        position: [lon, lat],
        price: Math.max(300000, price),
        yearMonth: yearMonth,
        area: 20 + Math.random() * 30
      });
    }
  }
  
  return data;
};

const RealEstateVisualization = () => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // 產生模擬資料
  const allData = useMemo(() => generateMockData(), []);
  
  // 取得所有唯一的月份
  const allMonths = useMemo(() => {
    const months = [...new Set(allData.map(d => d.yearMonth))].sort();
    return months;
  }, [allData]);
  
  // 當前月份的資料
  const currentData = useMemo(() => {
    const currentMonth = allMonths[currentMonthIndex];
    return allData.filter(d => d.yearMonth === currentMonth);
  }, [allData, allMonths, currentMonthIndex]);
  
  // 自動播放
  React.useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentMonthIndex(prev => {
        if (prev >= allMonths.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    
    return () => clearInterval(interval);
  }, [isPlaying, allMonths.length]);
  
  // 視角設定 - 2D 俯視視角
  const INITIAL_VIEW_STATE = {
    longitude: 121.5654,
    latitude: 25.0330,
    zoom: 12,
    pitch: 0,  // 0 度為俯視（2D），45 度為斜視（3D）
    bearing: 0
  };
  
  // 顏色比例尺
  const colorScale = scaleLinear()
    .domain([300000, 500000, 700000, 900000])
    .range([
      [65, 182, 196],
      [127, 205, 187],
      [253, 180, 98],
      [214, 96, 77]
    ]);
  
  // Deck.gl 圖層
  const layers = [
    new GridLayer({
      id: 'grid-layer',
      data: currentData,
      pickable: true,
      extruded: false,  // false = 2D 平面, true = 3D 立體柱狀
      cellSize: 100, // 100公尺
      elevationScale: 0,  // 2D 模式不需要高度
      getPosition: d => d.position,
      getColorWeight: d => d.price,
      getElevationWeight: d => d.price,
      colorAggregation: 'MEAN',
      elevationAggregation: 'MEAN',
      colorScaleType: 'quantile',
      opacity: 0.7,  // 調低透明度讓底圖更清楚
      getColorValue: points => {
        const avgPrice = points.reduce((sum, p) => sum + p.price, 0) / points.length;
        return avgPrice;
      },
      getElevationValue: points => {
        const avgPrice = points.reduce((sum, p) => sum + p.price, 0) / points.length;
        return avgPrice;
      },
      updateTriggers: {
        getColorValue: currentMonthIndex,
        getElevationValue: currentMonthIndex
      },
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      }
    })
  ];
  
  const handlePrevMonth = () => {
    setCurrentMonthIndex(prev => Math.max(0, prev - 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonthIndex(prev => Math.min(allMonths.length - 1, prev + 1));
  };
  
  const handleReset = () => {
    setCurrentMonthIndex(0);
    setIsPlaying(false);
  };
  
  return (
    <div className="relative w-full h-screen bg-gray-900">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        getTooltip={({ object }) => {
          if (!object) return null;
          const avgPrice = object.colorValue || 0;
          const count = object.points?.length || 0;
          return {
            html: `
              <div class="bg-white p-3 rounded shadow-lg">
                <div class="font-bold text-gray-800">房價資訊</div>
                <div class="text-sm text-gray-600">
                  平均單價: ${(avgPrice / 10000).toFixed(1)} 萬/坪<br/>
                  交易筆數: ${count}
                </div>
              </div>
            `,
            style: {
              backgroundColor: 'transparent',
              fontSize: '0.8em'
            }
          };
        }}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          mapboxAccessToken="pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw"
          onLoad={() => setMapLoaded(true)}
          onError={(error) => {
            console.warn('Map load error (可忽略):', error);
            setMapLoaded(true); // 即使地圖載入失敗，仍然顯示數據層
          }}
        />
      </DeckGL>
      
      {/* 控制面板 */}
      <div className="absolute top-6 left-6 bg-white rounded-lg shadow-xl p-6 max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          房地產交易視覺化
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          每個格子為 100m × 100m，顏色代表該月份房價平均值
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <div className="text-sm text-gray-600 mb-1">當前月份</div>
          <div className="text-3xl font-bold text-blue-600">
            {allMonths[currentMonthIndex]}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            交易筆數: {currentData.length}
          </div>
        </div>
        
        {/* 時間軸滑桿 */}
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={allMonths.length - 1}
            value={currentMonthIndex}
            onChange={(e) => {
              setCurrentMonthIndex(parseInt(e.target.value));
              setIsPlaying(false);
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{allMonths[0]}</span>
            <span>{allMonths[allMonths.length - 1]}</span>
          </div>
        </div>
        
        {/* 播放控制按鈕 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition"
          >
            <SkipBack size={18} />
            重置
          </button>
          <button
            onClick={handlePrevMonth}
            disabled={currentMonthIndex === 0}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ◀
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
          >
            {isPlaying ? (
              <>
                <Pause size={18} />
                暫停
              </>
            ) : (
              <>
                <Play size={18} />
                播放
              </>
            )}
          </button>
          <button
            onClick={handleNextMonth}
            disabled={currentMonthIndex === allMonths.length - 1}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶
          </button>
        </div>
        
        {/* 圖例 */}
        <div className="border-t pt-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">價格圖例</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-6 rounded" style={{
              background: 'linear-gradient(to right, rgb(65, 182, 196), rgb(127, 205, 187), rgb(253, 180, 98), rgb(214, 96, 77))'
            }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>30萬/坪</span>
            <span>50萬/坪</span>
            <span>70萬/坪</span>
            <span>90萬/坪</span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mt-4 border-t pt-3">
          💡 提示：拖曳地圖可平移，滑鼠滾輪可縮放
        </div>
      </div>
      
      {/* 統計資訊 */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-xl p-4 max-w-xs">
        <h3 className="font-semibold text-gray-800 mb-2">本月統計</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs">平均單價</div>
            <div className="font-bold text-blue-600">
              {(currentData.reduce((sum, d) => sum + d.price, 0) / currentData.length / 10000).toFixed(1)} 萬
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">交易筆數</div>
            <div className="font-bold text-green-600">
              {currentData.length}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">最高單價</div>
            <div className="font-bold text-red-600">
              {(Math.max(...currentData.map(d => d.price)) / 10000).toFixed(1)} 萬
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">最低單價</div>
            <div className="font-bold text-gray-600">
              {(Math.min(...currentData.map(d => d.price)) / 10000).toFixed(1)} 萬
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealEstateVisualization;
