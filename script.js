// عناصر الواجهة الأساسية
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
const resultSection = document.getElementById('resultSection');
const previewImage = document.getElementById('previewImage');
const scannerOverlay = document.getElementById('scannerOverlay');
const analysisCard = document.getElementById('analysisCard');

// عناصر عرض نتيجة الوجبة
const mealNameEl = document.getElementById('mealName');
const mealWeightEl = document.getElementById('mealWeight');
const mealCaloriesEl = document.getElementById('mealCalories');
const mealProteinEl = document.getElementById('mealProtein');
const mealCarbsEl = document.getElementById('mealCarbs');
const mealFatsEl = document.getElementById('mealFats');
const mealAdviceEl = document.getElementById('mealAdvice');

// أزرار التحكم بالنتيجة
const addMealBtn = document.getElementById('addMealBtn');
const cancelResultBtn = document.getElementById('cancelResultBtn');

// عناصر الملخص والسجل
const totalCaloriesEl = document.getElementById('totalCalories');
const dailyGoalTextEl = document.getElementById('dailyGoalText');
const caloriesProgressEl = document.getElementById('caloriesProgress');
const totalProteinEl = document.getElementById('totalProtein');
const totalCarbsEl = document.getElementById('totalCarbs');
const totalFatsEl = document.getElementById('totalFats');
const mealsListEl = document.getElementById('mealsList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// عناصر نافذة الإعدادات
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const dailyGoalInput = document.getElementById('dailyGoalInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// حالة التطبيق المحفوظة
let meals = JSON.parse(localStorage.getItem('calorieScan_meals')) || [];
let dailyGoal = parseInt(localStorage.getItem('calorieScan_goal')) || 2000;
let geminiApiKey = localStorage.getItem('calorieScan_apiKey') || '';
let currentAnalyzedMeal = null;

// تشغيل التحديث الأولي عند فتح التطبيق
initApp();

function initApp() {
  dailyGoalTextEl.textContent = dailyGoal;
  dailyGoalInput.value = dailyGoal;
  apiKeyInput.value = geminiApiKey;
  renderDashboard();
}

// الاستماع لاختيار صورة من الكاميرا أو الاستوديو
cameraInput.addEventListener('change', handleImageUpload);
galleryInput.addEventListener('change', handleImageUpload);

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // إعادة تعيين الحقل للسماح باختيار نفس الصورة مجدداً إذا لزم
  event.target.value = '';

  try {
    // ضغط الصورة وتحويلها إلى Base64 لتكون سريعة وخفيفة على الهاتف
    const compressedDataUrl = await compressImage(file, 800, 0.8);
    
    // إظهار قسم المعاينة والماسح الضوئي
    previewImage.src = compressedDataUrl;
    resultSection.classList.remove('hidden');
    scannerOverlay.classList.remove('hidden');
    analysisCard.classList.add('hidden');

    // التمرير بسلاسة نحو منطقة التحليل
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // تحليل الصورة (إما عبر Gemini AI الحقيقي أو وضع التجربة الذكي)
    let resultData;
    if (geminiApiKey.trim() !== '') {
      resultData = await analyzeWithGemini(compressedDataUrl, geminiApiKey.trim());
    } else {
      resultData = await simulateAnalysis();
    }

    // حفظ النتيجة المؤقتة وعرضها
    currentAnalyzedMeal = {
      id: Date.now(),
      image: await compressImage(file, 200, 0.6), // صورة مصغرة خفيفة للسجل
      ...resultData
    };

    displayAnalysisResult(currentAnalyzedMeal);

  } catch (error) {
    console.error('خطأ في تحليل الصورة:', error);
    scannerOverlay.classList.add('hidden');
    alert('حدث خطأ أثناء تحليل الصورة: ' + error.message);
    resultSection.classList.add('hidden');
  }
}

// دالة ضغط الصورة لتوفير مساحة التخزين وتسريع الرفع
function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// الاتصال الحقيقي بـ Gemini Vision API لتحليل صورة الوجبة
async function analyzeWithGemini(base64DataUrl, apiKey) {
  const base64Content = base64DataUrl.split(',')[1];
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const promptText = `أنت خبير تغذية محترف. حلل صورة الطعام هذه بدقة وأرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي أو علامات تنسيق markdown.
يجب أن يحتوي كائن JSON على المفاتيح التالية بالضبط:
{
  "name": "اسم الوجبة بالعربية بشكل مختصر وواضح",
  "weight": "الوزن أو الكمية التقديرية بالعربية (مثال: 350 جرام)",
  "calories": رقم صحيح للسعرات الحرارية التقديرية,
  "protein": رقم صحيح لجرامات البروتين,
  "carbs": رقم صحيح لجرامات الكربوهيدرات,
  "fats": رقم صحيح لجرامات الدهون,
  "advice": "نصيحة غذائية قصيرة ومفيدة عن هذه الوجبة في سطر واحد بالعربية"
}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Content
            }
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    throw new Error('تأكد من صحة مفتاح API أو اتصالك بالإنترنت.');
  }

  const data = await response.json();
  let rawText = data.candidates[0].content.parts[0].text;
  
  // تنظيف النص لاستخراج JSON نقي
  rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(rawText);
}

// وضع المحاكاة الذكي (يعمل فوراً إذا لم يضع المستخدم مفتاح API بعد)
function simulateAnalysis() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sampleMeals = [
        {
          name: 'صدر دجاج مشوي مع أرز وخضار',
          weight: '380 جرام تقريباً',
          calories: 520,
          protein: 42,
          carbs: 54,
          fats: 12,
          advice: 'وجبة متوازنة وغنية بالبروتين! مناسبة جداً لبناء العضلات والشبع لفترة طويلة. (وضع المحاكاة)'
        },
        {
          name: 'سلطة سيزر بالدجاج المشوي',
          weight: '300 جرام تقريباً',
          calories: 390,
          protein: 32,
          carbs: 16,
          fats: 21,
          advice: 'خيار خفيف ومغذٍ، يمكنك تقليل كمية الصلصة لخفض الدهون المشبعة. (وضع المحاكاة)'
        },
        {
          name: 'شريحة بيتزا بالجبن والخضار',
          weight: '220 جرام تقريباً',
          calories: 480,
          protein: 19,
          carbs: 52,
          fats: 22,
          advice: 'مرتفعة بالكربوهيدرات والدهون؛ يفضل تناولها مع طبق سلطة خضراء. (وضع المحاكاة)'
        }
      ];
      const randomMeal = sampleMeals[Math.floor(Math.random() * sampleMeals.length)];
      resolve(randomMeal);
    }, 2000);
  });
}

// عرض بطاقة التحليل للمستخدم
function displayAnalysisResult(meal) {
  scannerOverlay.classList.add('hidden');
  analysisCard.classList.remove('hidden');

  mealNameEl.textContent = meal.name;
  mealWeightEl.textContent = `الكمية التقديرية: ${meal.weight}`;
  mealCaloriesEl.textContent = meal.calories;
  mealProteinEl.textContent = `${meal.protein}g`;
  mealCarbsEl.textContent = `${meal.carbs}g`;
  mealFatsEl.textContent = `${meal.fats}g`;
  mealAdviceEl.textContent = `💡 ${meal.advice}`;
}

// إضافة الوجبة المحللة إلى سجل اليوم
addMealBtn.addEventListener('click', () => {
  if (!currentAnalyzedMeal) return;

  meals.unshift(currentAnalyzedMeal);
  saveMeals();
  renderDashboard();

  // إخفاء منطقة التحليل بعد الإضافة
  currentAnalyzedMeal = null;
  resultSection.classList.add('hidden');
});

// إلغاء النتيجة الحالية
cancelResultBtn.addEventListener('click', () => {
  currentAnalyzedMeal = null;
  resultSection.classList.add('hidden');
});

// حذف وجبة واحدة من السجل
window.deleteMeal = function(id) {
  meals = meals.filter(m => m.id !== id);
  saveMeals();
  renderDashboard();
};

// مسح جميع وجبات اليوم
clearHistoryBtn.addEventListener('click', () => {
  if (meals.length === 0) return;
  if (confirm('هل تريد مسح جميع وجبات اليوم؟')) {
    meals = [];
    saveMeals();
    renderDashboard();
  }
});

// حفظ الوجبات في ذاكرة الجهاز
function saveMeals() {
  localStorage.setItem('calorieScan_meals', JSON.stringify(meals));
}

// تحديث لوحة الإحصائيات وقائمة الوجبات
function renderDashboard() {
  let totalCal = 0;
  let totalPro = 0;
  let totalCarb = 0;
  let totalFat = 0;

  meals.forEach(m => {
    totalCal += Number(m.calories) || 0;
    totalPro += Number(m.protein) || 0;
    totalCarb += Number(m.carbs) || 0;
    totalFat += Number(m.fats) || 0;
  });

  totalCaloriesEl.textContent = totalCal;
  totalProteinEl.textContent = totalPro;
  totalCarbsEl.textContent = totalCarb;
  totalFatsEl.textContent = totalFat;

  // تحديث شريط التقدم
  const percentage = Math.min((totalCal / dailyGoal) * 100, 100);
  caloriesProgressEl.style.width = `${percentage}%`;

  // تغيير لون الشريط للأحمر إذا تم تجاوز الهدف
  if (totalCal > dailyGoal) {
    caloriesProgressEl.style.background = '#fca5a5';
  } else {
    caloriesProgressEl.style.background = '#ffffff';
  }

  // رسم قائمة الوجبات
  if (meals.length === 0) {
    mealsListEl.innerHTML = `<p class="empty-state">لم تقم بإضافة أي وجبة اليوم. التقط صورة لوجبتك للبدء!</p>`;
    return;
  }

  mealsListEl.innerHTML = meals.map(meal => `
    <div class="meal-item">
      <div class="meal-item-left">
        <img src="${meal.image}" alt="${meal.name}" class="meal-thumb" />
        <div class="meal-item-info">
          <h4>${meal.name}</h4>
          <span>بروتين ${meal.protein}غ • كارب ${meal.carbs}غ • دهون ${meal.fats}غ</span>
        </div>
      </div>
      <div class="meal-item-right">
        <span class="meal-item-cal">${meal.calories} سعرة</span>
        <button class="delete-item-btn" onclick="deleteMeal(${meal.id})" title="حذف">✕</button>
      </div>
    </div>
  `).join('');
}

// إدارة نافذة الإعدادات
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
  const newGoal = parseInt(dailyGoalInput.value);
  if (newGoal && newGoal >= 500) {
    dailyGoal = newGoal;
    localStorage.setItem('calorieScan_goal', dailyGoal);
    dailyGoalTextEl.textContent = dailyGoal;
  }

  geminiApiKey = apiKeyInput.value.trim();
  localStorage.setItem('calorieScan_apiKey', geminiApiKey);

  renderDashboard();
  settingsModal.classList.add('hidden');
  alert('تم حفظ الإعدادات بنجاح!');
});