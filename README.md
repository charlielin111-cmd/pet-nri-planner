# Nourish Pal

1.      幫我製作一個寵物食品營養計算的應用APP。APP主要用途為點選設定好的各項配料，輸入使用數量後，換算成總體的營養價值，然後比對[規範限值]要求的數值，告知我哪裡需要調整。

2.      專案分為以下幾個專案區:[配方組成]、[原料設定]、[規範限值]

3.      [配方組成]主頁中分為上半部的搜尋區，和下半部的結果呈現區，搜尋區連動 [原料設定]成立的資料庫中各個原料選項。使用方式為：依條件搜尋原料選項，選取後會依序填入結果呈現區。在結果呈現區中，依喜好填入原料使用的數量，填入的方式可以直接填入數字或使用拖曳拉桿，並在右側的即時計算UI顯示加總資料和圓餅圖；各原料的單位為公克。

[配方組成]在搜尋區上方顯示加總UI，快速呈現粗蛋白質、粗脂肪、碳水化合物、鈣磷比(鈣/磷)。

4.      結果呈現區UI設定：原料選項按住最左側的按鈕可以拖曳，以半透明方式緊跟滑鼠。選項最右側可以點選刪除圖示進行刪除。

5.      [原料設定]的各原料選項的參數組成包含：

6.      大標題：物料編號、品名、每公克價格、營養成分組成，各原料選項排序依物料編號升序排列。

7.      營養成分組成為以下五大類-

蛋白質與胺基酸類：粗蛋白質 (Crude Protein)、精胺酸 (Arginine)、組胺酸 (Histidine)、異亮胺酸 (Isoleucine)、亮胺酸 (Leucine)、離胺酸 (Lysine)、甲硫胺酸 (Methionine)、甲硫胺酸-胱胺酸 (Methionine-cystine)、苯丙胺酸 (Phenylalanine)、苯丙胺酸-酪胺酸 (Phenylalanine-tyrosine)、蘇胺酸 (Threonine)、色胺酸 (Tryptophan)、纈胺酸 (Valine)

脂肪與脂肪酸類：粗脂肪 (Crude Fat)、亞麻油酸 (Linoleic acid)、α-次亞麻油酸(alpha-Linolenic acid)、花生四烯酸 (Arachidonic acid)、二十碳五烯酸 + 二十二碳六烯酸 (EPA + DHA)Eicosapentaenoic + Docosahexaenoic acid

礦物質類：鈣 (Calcium)、磷 (Phosphorus)、鉀 (Potassium)、鈉 (Sodium)、氯 (Chloride)、鎂 (Magnesium)、鐵 (Iron)、銅 (Copper - 擠壓成型)、銅 (Copper - 罐頭)、錳 (Manganese)、鋅 (Zinc)、碘 (Iodine)、硒 (Selenium)

維生素與其他類 (Vitamins & Others)：維生素 A (Vitamin A)、維生素 D (Vitamin D)、維生素 E (Vitamin E)、維生素 K (Vitamin K)、硫胺素 (Thiamine)、核黃素(Riboflavin)、泛酸 (Pantothenic acid)、菸鹼酸 (Niacin)、吡哆醇 (Pyridoxine)、葉酸 (Folic acid)、生物素 (Biotin)、維生素 B₁₂ (Vitamin B₁₂)、膽鹼 (Choline)、牛磺酸(Taurine - 擠壓成型)、牛磺酸 (Taurine - 罐頭)

碳水化合物類

各營養素依上述依序排列，備註為每1000 kcal ME中所含的量；各參數設定若輸入ND，則代表未設定，呈現ND。

8.      營養成分組成，各類的單位為：蛋白質與胺基酸類單位為公克，脂肪與脂肪酸類單位為公克，礦物質類鈣~鎂單位為公克、鐵~硒為毫克，維生素與其他類單位維生素A~維生素E為IU、維生素K~膽鹼為毫克、牛磺酸為公克；碳水化合物為公克。

9.      [規範限值]設定成立資料庫，可自由增加、編輯選項，選項內容；編排順序與[原料設定]的資料庫連動。[規範限值]可依照不同市場通路要求，設定多種不同的選項。[規範限值]的判定採該參數應達：最小限值(≧)、最大限值(≦)以及應在範圍內(最小~最大)。

10.  在主頁頂端顯示Latest Update時間UI，若[規範限值]、[原料設定]的資料庫更新將會連動主頁頂部的更新時間，更新時間以台北時區24小時制呈現。

11.  [配方組成]編輯區上方可核取使用[規範限值]哪一種通路要求來進行審查；若[配方組成]的結果呈現區各營養成分組成含量加總，未達到[規範限值]，在畫面最下方顯示警告，以及不合格者為何。

12.  各UI、資料範圍若超出視窗，可使用卷軸下拉或折疊面板；可根據畫面大小需求使用卷軸上下瀏覽，摺疊的功能項目展開時可複數展開，不會因為展開其他選項而收合原來選項。

 

Patch 1

1.      請把介面美術設計更改為白底明亮簡潔

2.      [配方組成]更改設計：[配方組成]主頁上半部的搜尋區，和下半部的結果呈現區合併，稱之為編輯區，編輯區連動 [原料設定]成立的資料庫中各個原料選項。使用方式為：依條件搜尋原料選項，選取後會依序填入結果呈現區。在結果呈現區中，依喜好填入原料使用的數量，填入的方式可以直接填入數字或使用拖曳拉桿，並在右側的即時計算UI顯示加總資料和圓餅圖；各原料的單位為公克。

[配方組成]在搜尋區上方顯示加總UI，快速呈現粗蛋白質、粗脂肪、碳水化合物、鈣磷比(鈣/磷)，加總UI可自由編輯增減

3.      Edit Market Channel中的Nutrient Limits 數量和排列連動Ingredient Database中的營養成分組成。Ingredient Database的各營養成分組成項目可以自由增減、編輯

4.      新增專案區[配方]：新增配方的資料庫，APP使用順序變更為先在[配方]新增配方專案之後再進行[配方組成]的編輯。需在[配方]輸入配方編號、配方名稱、配方對應通路，之後儲存配方。儲存後可以在頁面下方看到配方一覽表，一覽表內有配方相關資訊如配方編號、配方名稱、配方對應通路、最後更新時間等。配方一覽表每項配方最右側有一個匯出功能，可以將配方內的使用物料以及成分組成一覽表、圓餅圖UI等資料匯出成excel檔案。

5.      新增[配方組成]的選取配方UI，可抓取[配方]中成立的配方專案進行編輯，並在編輯結束後按下儲存。

 

Patch 2

1.      配方編輯的頁面中，原料庫、配方原料的UI改為滿版顯示

2.      [配方編輯]中的圓餅圖-巨量營養素分佈的名稱改為營養成分組成圖，將各項不同營養組成更改成不同的顏色，且在圓餅圖下方的文字敘述加上數字百分比

 

Patch 3.0

1.      新增當地資料庫的建立功能-可以在各PC使用者建議資料庫資料夾，然後將資料離線儲存在各自的電腦中，開啟APP時可各自讀取他們儲存的資料

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pet-nri-planner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2145407c-5868-4f1e-9ffb-892a3983f874).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
