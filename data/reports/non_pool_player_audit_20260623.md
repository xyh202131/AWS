# 不在答题卡球员池的候选审计

## 结论

- “不存在”在这里应理解为：不在比赛答题卡 `球员池_勿修改` / `PlayerPool` 下拉选项中，不代表现实里没有这个球员。
- 前端候选包人数：101；答题卡球员池行数：124；答题卡唯一姓名数：123。
- 前端 101 人中有 17 人不在答题卡池；其中进入当前前端首轮的只有 1 人。
- 答题卡池中有 39 人没有匹配到前端 101 人，已由本地 124 人池版使用 fallback profile 参与预测。
- 答题卡池重复行：1，重复项为 `纳撒尼尔 阿门特`。
- 体测/特征 124 参考表没有发现“表内额外姓名不在答题卡池”的污染；`extraSheetNamesNotInPool` 四项均为空。

## 影响提交的项

- 第 30 顺位 Dallas Mavericks: `Marc-Owen Fodzo Dada` / `马克-欧文 福佐 达达` 不在答题卡下拉池；官方 124 人池版已改为 `Jack Kayil` / `杰克 卡伊尔`。

## 前端 101 中不在答题卡池的 17 人

- `Bassala Bagayoko` (bassala-bagayoko)：rank 31, C, Bilbao Basket (Spain), Mali；影响：候补出现 P26, P29。
- `Chad Baker-Mazara` (chad-baker-mazara)：rank 98, SG/SF, USC, Dominican Republic；影响：未进入首轮/候补关键位。
- `Donovan Atwell` (donovan-atwell)：rank 71, PG/SG, Texas Tech, United States；影响：未进入首轮/候补关键位。
- `Duke Miles` (duke-miles)：rank 93, PG/SG, Vanderbilt, United States；影响：未进入首轮/候补关键位。
- `Graham Ike` (graham-ike)：rank 78, SF/PF, Gonzaga, United States；影响：未进入首轮/候补关键位。
- `Isaac McKneely` (isaac-mckneely)：rank 61, PG/SG, Louisville, United States；影响：未进入首轮/候补关键位。
- `Jalen Washington` (jalen-washington)：rank 88, C, Vanderbilt, United States；影响：未进入首轮/候补关键位。
- `Jaxon Kohler` (jaxon-kohler)：rank 81, SF/PF, Michigan State, United States；影响：未进入首轮/候补关键位。
- `Jaylin Sellers` (jaylin-sellers)：rank 86, PG/SG, Providence, United States；影响：未进入首轮/候补关键位。
- `Kashie Natt` (kashie-natt)：rank 83, PG/SG, Sam Houston State, United States；影响：未进入首轮/候补关键位。
- `Malique Lewis` (malique-lewis)：rank 40, SF/PF, South East Melbourne (Australia), Trinidad and Tobago；影响：未进入首轮/候补关键位。
- `Marc-Owen Fodzo Dada` (marc-owen-fodzo-dada)：rank 32, PG/SG, Nancy Basket (France), France；影响：当前首轮第30顺位；候补出现 P28。
- `Noam Yaacov` (noam-yaacov)：rank 43, PG/SG, Telenet BC Oostende (Belgium), Denmark；影响：未进入首轮/候补关键位。
- `Reynan dos Santos` (reynan-dos-santos)：rank 70, SF/PF, Mexico City Capitanes (G League), Brazil；影响：未进入首轮/候补关键位。
- `Rienk Mast` (rienk-mast)：rank 92, C, Nebraska, Netherlands；影响：未进入首轮/候补关键位。
- `Tre Carroll` (tre-carroll)：rank 74, C, Xavier, United States；影响：未进入首轮/候补关键位。
- `Tre Donaldson` (tre-donaldson)：rank 51, PG/SG, Miami (FL), United States；影响：未进入首轮/候补关键位。

## 答题卡池有但前端 101 没匹配到的 39 人

- #44 `狄龙 米切尔`，前锋，圣约翰大学，-
- #59 `安德烈 斯托亚科维奇`，SF，-，-
- #60 `小杰里米 费尔斯`，PG，-，-
- #61 `小比利 里士满三世`，SF，-，-
- #62 `弗洛里 比敦加`，C，-，-
- #64 `泰勒 坦纳`，PG，-，-
- #65 `米兰 莫姆契洛维奇`，PF，-，-
- #66 `约翰 布莱克威尔`，SG，-，-
- #68 `路易吉 苏伊戈`，中锋，意大利，意大利
- #69 `通德 耶苏福`，SG，-，-
- #72 `阿马里 阿伦`，SF，-，-
- #73 `雅各布 科菲`，PF，-，-
- #74 `马修 埃布尔`，SG，-，-
- #76 `鲁本 钦耶卢`，C，-，-
- #77 `小克里斯托弗 布朗`，PG，-，-
- #78 `杰登 哈里斯`，SF，-，-
- #79 `AJ 施托尔`，后卫，密西西比大学，-
- #80 `BJ 爱德华兹`，后卫，南卫理公会大学，-
- #81 `亚当 阿塔姆纳`，后卫，法国，-
- #82 `克肖恩 墨菲`，前锋，奥本大学，-
- #85 `凯德 泰森`，后卫，明尼苏达大学，-
- #89 `多诺万 登特`，后卫，UCLA，-
- #91 `奥格年 斯尔曾蒂奇`，前锋，塞尔维亚，-
- #96 `布赖森 塔克`，前锋，华盛顿大学，-
- #97 `帕夫莱 巴奇科`，中锋，塞尔维亚，-
- #99 `弗朗西斯科 法拉利`，前锋，意大利，意大利
- #101 `戴米恩 科林斯`，前锋，南佛罗里达大学，-
- #102 `拉贾伊 琼斯`，后卫，佛罗里达州立大学，-
- #104 `本 亨歇尔`，后卫，澳大利亚，-
- #106 `泰恩 格兰特-福斯特`，后卫，冈萨加大学，-
- #108 `特伦斯 阿西诺`，后卫，北卡罗来纳州立大学，-
- #109 `特雷 怀特`，后卫，堪萨斯大学，-
- #110 `穆罕默德 费伊`，中锋，塞内加尔，-
- #112 `米伊卡 穆里宁`，前锋，芬兰，-
- #114 `莱利 库格尔`，后卫，中佛罗里达大学，-
- #115 `蒂埃里 达尔兰`，后卫，圣塔克拉拉大学，-
- #117 `达什 丹尼尔斯`，后卫，澳大利亚，-
- #121 `迈克尔 鲁日奇`，中锋，克罗地亚，-
- #123 `马利克 尤因`，前锋，阿肯色大学，-

## 建议处理

1. 提交答题卡必须以 `data/boards/local_pool_124_baseline_board.json` 或同类 124 人池版为准。
2. 前端推荐板应同步第 30 位：`Marc-Owen Fodzo Dada` -> `Jack Kayil`，否则页面和答题卡不一致。
3. 预测脚本应加硬约束：最终 30 人必须全部存在于答题卡 `PlayerPool`，否则构建或审计失败。
4. RAG 可以保留 NBA.com 101 作为背景证据，但回答“提交预测”时必须优先引用答题卡 124 人池。
