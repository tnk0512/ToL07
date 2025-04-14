// Set up D3 layout and arc
var width = 700,
    height = 560,
    maxradius = Math.min(width, height) / 2,
    centerX = width / 2,
    centerY = height / 2;

var overwidth = 200,
    overheight = 200,
    overmaxradius = Math.min(overwidth, overheight) / 2;

var x = d3.scale.linear().range([0, 2 * Math.PI]);

var y = d3.scale.linear().range([0, maxradius]);

var partition = d3.layout.partition()
    .value(function(d) { return d.value; })  // Use the value attribute from the JSON data
    .sort(null);

var arc = d3.svg.arc()
    .startAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, x(d.x))) + offset; })
    .endAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) + offset; })
    .innerRadius(function(d) { return Math.max(0, y(d.y)); })
    .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });

var svg = d3.select("body").append("svg")
    .attr("id", "mainSvg")
    .attr("width", width)
    .attr("height", height)
    .style("position", "absolute")
    .style("top", "20%")  // 任意のオフセット
    .style("left", "20%") // 任意のオフセット
    .append("g")
    .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

// `mainSvg`の位置を取得
var mainSvgElement = document.getElementById("mainSvg");
var mainSvgRect = mainSvgElement.getBoundingClientRect();

// グラフ設定を大域変数から取得
const config = window.graphConfig || {
    colorChange: true,
    animation: true,
    ease: false,
    timing: null,
    topNode: null,
    interaction: true,
    taskMode: false,
    task: null
};

// クリッピングパスを追加して、maxradius以上の領域が表示されないようにする
svg.append("clipPath")
    .attr("id", "circleClip")
    .append("circle")
    .attr("r", maxradius);

// `clip-path` 属性を適用して円形にクリッピング
svg.attr("clip-path", "url(#circleClip)");

// 画像配置用の別SVGを mainSvg の上に重ねて追加
var imgSvg = d3.select("body").append("svg")
    .attr("id", "imgSvg")
    .attr("width", width+100)
    .attr("height", height+300)
    .style("position", "absolute")
    .style("top", `calc(20% - 150px)`)
    .style("left", `calc(20% - 50px)`)
    .style("pointer-events", "none"); // 画像以外は無効化

// ドラッグ可能なバー用の別SVG要素
var barSvg = d3.select("body").append("svg")
    .attr("id", "barSvg")
    .attr("width", width)
    .attr("height", height + 100)  // 高さを調整
    .style("position", "absolute")
    //.style("top", `${mainSvgRect.top - 50}px`)
    .style("top", `calc(20% - 50px)`)
    //.style("left", `${mainSvgRect.left}px`);
    .style("left", `20%`);

// 中心点を基準にドラッグできるバー
var draggableBar = barSvg.append("rect")
    .attr("id", "draggableBar")
    .attr("width", 20)
    .attr("height", 50)
    .attr("x", centerX - 10) // 中央に配置
    .attr("y", centerY - maxradius) // 円周上に配置
    .style("cursor", "grab")
    .style("fill", "grey")
    .attr("transform-origin", "10px 25px"); // 長方形の中心を基準に回転

var tooltip = d3.select("body").append("div").attr("class", "tooltip");
// 太枠のスタイル
const boldStrokeStyle = {
    "stroke": "black",
    "stroke-width": "2px",
    "fill-opacity": 1,
    };

// サブツリー内のノードリスト
let subtreeNodeNames = [];
var overviewSvg;
//var levels = 5;
var maxdepth = 20;  //6 or 20
// 基準
var sizeCriterion = 12; // クリック可能なノード
var labelCriterion = 30; // ラベルを表示するノード
let offset = 0; // 共通のオフセット値
let drag_offset = 0; // ドラッグによるオフセット
let imageMap = {};

d3.json("/static/data/image_mapping.json", function(error, data) {
    if (error) {
        console.error("Error loading JSON:", error);
        return;
    }
    imageMap = data;
});

// ドラッグイベントの設定
function initializeDrag(nodes, arc, parentNode, root) {
    let normalizedAngle = 0;
    return d3.behavior.drag()
        .on("dragstart", function () {
            svg.selectAll("text").style("visibility", "hidden"); // ラベルを非表示
            imgSvg.selectAll("image").remove();
        })
        .on("drag", function () {
            // d3.eventから座標を取得
            var mouseX = d3.event.x;
            var mouseY = d3.event.y;
            // 中心からの角度を計算（ラジアン）
            var angle = Math.atan2(mouseY - centerY, mouseX - centerX);
            // 正規化された角度を計算（0から1の範囲）
            var correctedAngle = angle + Math.PI / 2; // 角度の補正
            normalizedAngle = (correctedAngle >= 0 ? correctedAngle : (2 * Math.PI + correctedAngle)) / (2 * Math.PI);
    
            // 新しい座標を計算（長方形の中心を円周上に配置する）
            var newX = centerX + (maxradius + 25) * Math.cos(angle) - 10; // x座標
            var newY = centerY + (maxradius + 25) * Math.sin(angle)+25; // y座標
    
            // バーの位置と回転を更新
            d3.select(this)
                .attr("x", newX)
                .attr("y", newY)
                .attr("transform", `rotate(${angle * (180 / Math.PI) + 90}, ${newX}, ${newY})`);

            // グラフを回転
            rotateChart(normalizedAngle, arc, parentNode);
        })
        .on("dragend", function () {
            // ノードデータを更新してラベルを再描画
            svg.selectAll("text").remove(); // ラベルを一旦削除
        
            
            // 通常ノードのパスを更新
            svg.selectAll("path:not(.parentNodeArc)")
                .attr("d", arc);
        
            // parentNode専用のパスを更新
            if (parentNode) {
                var parentY = d3.scale.linear().range([0, 20]); // parentNode用スケール
        
                svg.selectAll(".parentNodeArc")
                    .attr("d", d3.svg.arc()
                        .startAngle(function(d) { return Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                        .endAngle(function(d) { return Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                        .innerRadius(function(d) { return Math.max(0, parentY(d.y)); })
                        .outerRadius(function(d) { return Math.max(0, parentY(d.y + d.dy)); })
                    );
            }
        
            // ラベルを再描画
            if (!config.taskMode) {
                updateLabels(nodes, arc);
                if (imageMap[root.n]) {
                    drawCircularIcons(root, nodes, normalizedAngle);
                }
            }
        });
    }

// サンバーストチャートの回転を制御する関数
function rotateChart(normalizedAngle, arc) {
    var angleOffset = 2 * Math.PI * normalizedAngle;
    drag_offset = angleOffset;
    // parentNodeのarcを別途更新
    if (parentNode) {
        var parentY = d3.scale.linear().range([0, 20]);
    
        svg.selectAll(".parentNodeArc")
            .attr("d", arc.innerRadius(function(d) {
                return Math.max(0, parentY(d.y));
            }).outerRadius(function(d) {
                return Math.max(0, parentY(d.y + d.dy));
            }));
    }
    
    // 他のノードのarcを更新
    svg.selectAll("path:not(.parentNodeArc)")
        .attr("d", arc.startAngle(function(d) {
            return Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, x(d.x))) + offset + angleOffset;
        }).endAngle(function(d) {
            return Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) + offset + angleOffset;
        }));
    }

// 環状にアイコン画像を描画
function drawCircularIcons(d, nodes, normalizedAngle = 0) {
    if (!imageMap[d.n] || !imageMap[d.n].multiple_images) return;

    let infoPanel = d3.select("#info-panel");
    let nodeName = d3.select("#node-name");
    let nodeImage = d3.select("#node-image");
    let nodeWiki = d3.select("#node-wiki");
    let gridContainer = d3.select("#grid-container");
    const imgData = imageMap[d.n];
    const iconSize = 60;
    const radiusBase = maxradius + 40;
    const angleThreshold = 8 * (Math.PI / 180);
    const usedAngles = [];

    // 名前表示
    let nameContent = `<strong>${d.name}</strong><br>`;
    if (imgData.name_en) nameContent += `<span style="font-size: 10px;">English: ${imgData.name_en}</span><br>`;
    if (imgData.name_jp) nameContent += `<span style="font-size: 10px;">日本語: ${imgData.name_jp}</span><br>`;
    nodeName.html(nameContent);
    nodeWiki.attr("href", imgData.wiki).style("display", "inline-block");
    gridContainer.style("display", "none");

    imgSvg.selectAll("image").remove();

    imgData.multiple_images.forEach((img) => {
        let imgSrc;
        if (typeof img === "number" && imageMap[img]?.image) {
            imgSrc = `/static/images/${imageMap[img].image}`;
        } else {
            imgSrc = `/static/images/${img}`;
        }

        fetch('/ancestor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ n: String(img) })
        })
        .then(response => {
            if (!response.ok) throw new Error("Fetch failed");
            return response.json();
        })
        .then(data => {
            const selected = data.ancestors.find(a => String(a.n) === String(img));
            if (!selected) return;

            const ancestorNames = selected.ancestors;
            let deepest = null;
            nodes.forEach(n => {
                if (ancestorNames.includes(n.name)) {
                    if (!deepest || n.depth > deepest.depth) {
                        deepest = n;
                    }
                }
            });

            let dragOffset = 2 * Math.PI * normalizedAngle;
            let baseAngle = deepest ? -Math.max(0, Math.min(2 * Math.PI, x(deepest.x + deepest.dx / 2))) + offset + dragOffset : Math.PI / 2;
            let radiusOffset = 0;
            let tries = 0;
            const maxTries = 10;

            while (usedAngles.some(a => Math.abs(baseAngle - a) < angleThreshold) && tries < maxTries) {
                baseAngle += angleThreshold;
                radiusOffset += 10;
                tries++;
            }

            usedAngles.push(baseAngle);
            const finalRadius = radiusBase + radiusOffset;
            const xPos = (width + 100) / 2 + finalRadius * Math.cos(baseAngle) - iconSize / 2;
            const yPos = (height + 300) / 2 + finalRadius * Math.sin(baseAngle) - iconSize / 2;

            const tooltipContent = (() => {
                let content = "";
                if (typeof img === "number" && imageMap[img]) {
                    const info = imageMap[img];
                    if (info.name_en) content += `<strong>English:</strong> ${info.name_en}<br>`;
                    if (info.name_jp) content += `<strong>日本語:</strong> ${info.name_jp}<br>`;
                }
                return content;
            })();

            imgSvg.append("image")
                .attr("xlink:href", imgSrc)
                .attr("x", xPos)
                .attr("y", yPos)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", "circle(50%)")
                //.attr("preserveAspectRatio", "xMidYMid slice")
                .style("cursor", "pointer")
                .style("pointer-events", "auto")
                .attr("data-id", img)
                .on("click", function () {
                    fetchAncestors(img);
                })
                .on("mouseover", function () {
                    tooltip.style("visibility", "visible").html(`<strong>${deepest?.name || ""}</strong><br>${tooltipContent}`);
                })
                .on("mousemove", function () {
                    tooltip.style("top", (d3.event.pageY + 10) + "px")
                           .style("left", (d3.event.pageX + 10) + "px");
                })
                .on("mouseout", function () {
                    tooltip.style("visibility", "hidden");
                });
        })
        .catch(err => {
            console.error("Ancestor fetch failed:", err);
        });
    });
}

    // ラベルを更新する関数
function updateLabels(nodes, arc) {
    svg.selectAll("text").remove();
    
    svg.selectAll("text")
        .data(nodes.filter(function(d) {
            var r = y(d.y + d.dy / 2);
            var theta = x(d.x + d.dx) - x(d.x);
            return r * theta >= labelCriterion;
        }))
        .enter().append("text")
        .attr("transform", function(d) {
            return "translate(" + arc.centroid(d) + ")";
        })
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text(function(d) {
            return d.is_merged ? d.merge_count : d.n;
        });
    }

// task
// task
// ユーザーテスト処理開始 task用
// 質問リスト
const questions = [
    {
        id : "size1",
        type: "select",
        text: "★の扇形の中心角は全体の約何%を占めていると考えますか？",
        options: ["10%未満", "10%~30%", "30%~50%", "50%以上"],
        onAnswer: (selected) => {
            document.getElementById("answerInput").value = selected;
        }
    },
    {
        id : "size2",
        type: "click",
        text: "{depth}層目で最も大きい扇形を持つ領域をクリックしてください。",
        onAnswer: (node) => {
            document.getElementById("answerInput").value = node.n;
        }
    },
    {
        id: "size3",
        type: "select",
        text: "★は同一層上の扇型の中で、何番目に大きいですか？",
        options: ["1番目", "それ以外"],
        onAnswer: (selected) => {
            document.getElementById("answerInput").value = selected;
        }
    },
    {
        id: "size4",
        type: "click",
        text: "★と⚫︎で、大きい方をクリックしてください",
        onAnswer: (node) => {
            document.getElementById("answerInput").value = node.n;
        }
    },
    {
        id : "hierarchical",
        type: "click",
        text: "サブツリー内で、★と⚫︎の共通祖先は存在しますか？存在する場合は共通祖先の中で最も2つのノードに近い層のノードをクリックしてください。",
        onAnswer: (node) => {
            document.getElementById("answerInput").value = node.n;
        }
    }
];

function updateLabelsForTask(nodes, nodeNames) {
    svg.selectAll("text").remove(); // 全てのラベルを削除

    // 対象ノードに対するラベルを追加
    svg.selectAll("text")
        .data(nodes.filter(function(d) {
            return nodeNames.includes(d.n);
        }))
        .enter().append("text")
        .attr("transform", function(d) {
            if (config.task === "hierarchical") {
                // ラベルを中央に配置
                console.log("hierarchicalタスク");
                const [centerX, centerY] = arc.centroid(d);
                return "translate(" + arc.centroid(d) + ")";
                //return `translate(${centerX}, ${centerY})`;
            } else {
                // 通常のランダムな配置
                const [centerX, centerY] = arc.centroid(d);

                // 中心角度を計算 (atan2で角度取得)
                const centerAngle = Math.atan2(centerY, centerX);

                // ランダムな角度のずれを追加
                const angleOffset = (Math.random() - 0.5) * 0.6; // ±0.1ラジアンの範囲でずらす
                const randomAngle = centerAngle + angleOffset;

                // 半径はそのまま、角度方向のみ変更して新しい位置を計算
                const radius = Math.sqrt(centerX ** 2 + centerY ** 2);
                const x = Math.cos(randomAngle) * radius;
                const y = Math.sin(randomAngle) * radius;

                return `translate(${x}, ${y})`;
            }
        })        
        .attr("text-anchor", "middle")
        .each(function(d, i) {
            const textElement = d3.select(this);
            // ラベルの種類をインデックスに応じて切り替える
            const labelSymbol = i === 0 ? "★" : "●";
            textElement.attr("font-size", "25px").text(labelSymbol);
        });
}

function triggerNextTask() {
    console.log("Triggering next task...");
    const nextButton = document.getElementById("nextButton");
    if (nextButton) {
        nextButton.click(); // 「次へ」ボタンを自動的にクリック
    } else {
        console.warn("Next button not found.");
    }
}

function generateQuestion(nodes, task, node1, node2, depth, ans_num) {
    const questionArea = document.getElementById("questionArea");
    const questionText = document.getElementById("questionText");
    const answerArea = document.getElementById("answerArea");
    //console.log(`現在の問題：${task}`);

    // ランダムな質問を選択
    const taskId = config.task.startsWith("ex-") ? config.task.slice(3) : config.task;
    const Question = questions.find(question => question.id === taskId);
    if (!Question) {
        console.error(`No question definition found for task: ${config.task}`);
        return;
    }
    let answer;
    let isAnswered = false; // 回答済みフラグ

    if (taskId === "size1") {
        answer = AnswerSize1(ans_num); // 正解
        // 質問文を設定
        questionText.textContent = `${Question.text}`;
        // ラベルを更新
        updateLabelsForTask(nodes, [node1]);
    }
    if (taskId === "size2") {
        answer = String(ans_num);
        questionText.textContent = Question.text.replace("{depth}", depth);
        drawLayerCircles(depth);
    } 
    if (taskId === "size3") {
        answer = ans_num === 1 ? "1番目" : "それ以外";
        questionText.textContent = `${Question.text}`;
        updateLabelsForTask(nodes, [node1]);
    }
    if (taskId === "size4") {
        answer = String(ans_num);
        questionText.textContent = `${Question.text}`;
        updateLabelsForTask(nodes, [node1, node2]);
    }
    if (taskId === "hierarchical") {
        answer = String(ans_num);
        questionText.textContent = `${Question.text}`;
        updateLabelsForTask(nodes, [node1, node2]);
    }
    console.log(`正解 (${task}):`, answer);

    // 解答エリアをクリア
    answerArea.innerHTML = "";

    // 解答欄を生成
    const answerInput = document.createElement("input");
    answerInput.id = "answerInput";
    answerInput.type = "text";
    answerInput.style.width = "100%";
    answerInput.readOnly = true;

    if (Question.type === "click" || Question.type === "zoom") {
        config.interaction = false; // タスク用のインタラクションを無効化
    } else if (Question.type === "select") {
        Question.options.forEach(option => {
            const radioLabel = document.createElement("label");
            radioLabel.style.display = "block";
            radioLabel.style.fontSize = "18px"; // 選択肢の文字サイズを大きく
            radioLabel.style.margin = "10px 0";
            
            const radioInput = document.createElement("input");
            radioInput.type = "radio";
            radioInput.name = "questionOption";
            radioInput.value = option;
            radioInput.style.transform = "scale(1.5)"; // ボタンを大きく
            radioInput.style.marginRight = "10px";
            
            radioInput.addEventListener("click", () => Question.onAnswer(option));
            radioLabel.appendChild(radioInput);
            radioLabel.appendChild(document.createTextNode(option));
            answerArea.appendChild(radioLabel);
        });
    }
    answerArea.appendChild(answerInput);
    // 例題なら正解を表示
    if (config.task.startsWith("ex-")) {
        const answerNote = document.createElement("div");
        answerNote.style.marginTop = "10px";
        answerNote.style.fontSize = "18px";
        answerNote.style.color = "green";
        answerNote.textContent = `正解: ${answer}`;
        answerArea.appendChild(answerNote);
    }
    // タイマーで3秒後に次へ進む処理
    const timeLimit = config.task.startsWith("ex-") ? 10000 : 300;
    const timer = setTimeout(() => {
        if (!isAnswered) { // 未回答の場合のみ処理
            console.log("Time's up! Automatically moving to next task.");
            handleAnswerSubmission(answer, answerInput.value.trim());
            isAnswered = true; // 回答済みに設定
            triggerNextTask();
        }
    }, timeLimit);

    // 「次へ」ボタンのクリック処理
    nextButton.onclick = () => {
        if (!isAnswered) { // 未回答の場合のみ処理
            clearTimeout(timer); // タイマーを停止
            handleAnswerSubmission(answer, answerInput.value.trim());
            isAnswered = true; // 回答済みに設定
            triggerNextTask();
        }
    };
}

// タスクの正解
function AnswerSize1(num) {
    if (num === 1) {
        return "10%未満";
    } else if (num === 2) {
        return "10%~30%";
    } else if (num === 3) {
        return "30%~50%";
    } else {
        return "50%以上";
    }
}

function drawLayerCircles(depth) {
    // 現在のグラフからすべての円を削除
    svg.selectAll(".layer-circle").remove();

    // 内径と外径を取得
    const innerRadius = y(depth / 5);
    let outerRadius = y((depth + 1) / 5);

    // depth === 4 のとき外径を少し内側にする
    if (depth === 4) {
        outerRadius *= 0.99;
    }

    // 内径の円を描画
    svg.append("circle")
        .attr("class", "layer-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", innerRadius)
        .style("fill", "none")
        .style("stroke", "#4d4d4d")
        .style("stroke-width", "1.8px")
        .style("stroke-dasharray", "4,4");

    // 外径の円を描画
    svg.append("circle")
        .attr("class", "layer-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", outerRadius)
        .style("fill", "none")
        .style("stroke", "#4d4d4d")
        .style("stroke-width", "1.8px")
        .style("stroke-dasharray", "4,4");
}

// 回答の正誤判定とスコア計算を行う関数
function handleAnswerSubmission(correctAnswer, userAnswer) {
    let score = parseInt(localStorage.getItem("score"), 10) || 0;
    let taskResults = JSON.parse(localStorage.getItem("taskResults")) || [];
    let questionIndex = parseInt(localStorage.getItem("currentQuestionIndex"), 10) || 0;
    const currentURL = new URL(window.location.href);
    const currentTaskNum = parseInt(currentURL.searchParams.get("tasknum"), 10) || config.tasknum;
    let isCorrect = (userAnswer === correctAnswer);

    // スコアの更新
    if (isCorrect) {
        score += 1;
    }
    localStorage.setItem("score", score);
    
    // 結果を記録
    taskResults.push({
        question: currentTaskNum,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        result: isCorrect ? "○" : "×"
    });
    localStorage.setItem("taskResults", JSON.stringify(taskResults));
    
    console.log(`現在の点数: ${score}`);
}

function displayResults(score, taskResults) {
    // 例題のときはCSVボタンを表示しない
    if (config.task.startsWith("ex-")) {
        alert(`終了です。\n!!!OKを押さずに!!!、このページを閉じてください。`);
        return;
    }
    // CSV ダウンロードボタンを追加
    let downloadButton = document.createElement("button");
    downloadButton.textContent = "CSVをダウンロード";
    downloadButton.onclick = downloadCSV(taskResults);
    document.body.appendChild(downloadButton);
    alert(`終了です。\n!!!OKを押さずに!!!、このページを閉じてください。\n合計得点: ${score} / 40`);
}



function downloadCSV(taskResults) {
    let sortedResults = taskResults.sort((a, b) => a.question - b.question);
    let csvContent = "\ufeff" + "問題番号,あなたの回答,正解,結果,colorChange\n"; // UTF-8 BOMを追加
    
    sortedResults.forEach((result, index) => {
        let colorChange = (index < 20) ? 0 : 1; // 1~20個目は0、21~40個目は1
        csvContent += `${result.question},${result.userAnswer},${result.correctAnswer},${result.result},${colorChange}\n`;
    });
    let blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `test_${config.task}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function initializeforTask(task) {
    // タスクデータを取得
    fetch(`/load_task_data?task=${task}`)
        .then(response => response.json())
        .then(taskData => {
            if (taskData.length === 0) {
                console.error("No task data available for this task type.");
                return;
            }

            // タスクデータからランダムに1つ選択
            const taskNum = config.tasknum;
            const randomTask = taskData[taskNum];
            const { Top, node1, node2, depth, Answer, colorChange } = randomTask;

            // 初期設定
            config.topNode = Top;
            config.colorChange = colorChange > 0;
            //console.log(`Task: Top=${Top}, node1=${node1}, node2=${node2}, depth=${depth}, Answer=${Answer}, color=${colorChange}`);
            // 現在のグラフ情報から該当ノードを探索
            let currentNode = null;
        
            svg.selectAll("path").each(function(d) {
                if (d.n === config.topNode) {
                    currentNode = d; // 該当ノードを取得
                }
            });
        
            if (!currentNode) {
                console.error(`Node with n=${config.topNode} not found in the current tree.`);
                return;
            }
        
            // `startAngle` と `endAngle` を元の木構造で計算
            const startAngle = x(currentNode.x);
            const endAngle = x(currentNode.x + currentNode.dx);
            clicknodeDepth = currentNode.depth;
        
            // 中心角度の計算
            const opposingAngle = (startAngle + endAngle) / 2 - Math.PI;
            offset -= opposingAngle; // クリックによるオフセットを調整
        
            // ノード色のマップを作成
            const colorMap = {};
            svg.selectAll("path").each(function(d) {
                colorMap[d.name] = d3.select(this).style("fill");
            });
        
            fetch('/subtree', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ n: config.topNode })
            })
            .then(response => response.json())
            .then(data => {
                const subtree = data.newtree;
                const parentNode = data.parent;
        
                // グラフを即座に更新
                svg.selectAll("path").remove();
                svg.selectAll("text").remove();
        
                // 座標範囲をリセット
                x.range([0, 2 * Math.PI]);
                y.range([0, maxradius]);
        
                const nodes = partition.nodes(subtree);
        
                var overstartAngle = previousStartAngle + (previousEndAngle - previousStartAngle) * startAngle/(2*Math.PI);
                var overendAngle = previousStartAngle + (previousEndAngle - previousStartAngle) * endAngle/(2*Math.PI);
        
                // ノードの描画
                const path = svg.selectAll("path").data(nodes).enter().append("path")
                    .attr("d", arc)
                    .attr("data-id", d => d.n)
                    .style("fill", function(d) {
                        if (config.colorChange) {
                            return fillColor(d);
                        }
                        //return colorMap[d.name] || computeNodeColor(d, d.depth+clicknodeDepth, overstartAngle, overendAngle);
                        return computeNodeColor(d, d.depth+clicknodeDepth, overstartAngle, overendAngle);
                    })
                    .style("opacity", d => (d.is_merged ? 0.3 : 1));
        
                // クリック可能なパスを設定
                const clickablePaths = path.filter(d => {
                    const r = y(d.y + d.dy / 2);
                    const theta = x(d.x + d.dx) - x(d.x);
                    return r * theta >= sizeCriterion || d === d.parent;
                });
        
                clickablePaths.on("click", handleNodeClick);
                    //.on("mouseover", mouseover)
                    //.on("mouseout", mouseout);
        
                previousStartAngle = overstartAngle; // 追加：前回の開始角度を保存
                previousEndAngle = overendAngle; // 追加：前回の終了角度を保存
                overviewX = d3.scale.linear().range([overstartAngle, overendAngle]);
                overviewY = d3.scale.linear().range([
                    overmaxradius * clicknodeDepth / maxdepth,
                    overmaxradius * (clicknodeDepth + 4 < maxdepth ? clicknodeDepth + 4 : maxdepth) / maxdepth
                ]);
            
                var overviewArc = d3.svg.arc()
                    .startAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x))); })
                    .endAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x + d.dx))); })
                    .innerRadius(function(d) { return Math.max(0, overviewY(d.y)); })
                    .outerRadius(function(d) { return Math.max(0, overviewY(d.y + d.dy)); });
            
                var overviewSvg = d3.select("#overview").select("svg").select("g");
            
                overviewSvg.selectAll("path").remove();
            
                overviewSvg.selectAll("path")
                    .data(nodes)
                    .enter().append("path")
                    .attr("d", overviewArc)
                    .style("fill", function(d) {
                        const mainPath = svg.select(`path[data-id="${d.n}"]`);
                        if (!mainPath.empty()) {
                            d.overviewColor = mainPath.style("fill");
                            return d.overviewColor;
                        }
                    });
                updateNodeCount(nodes);
                generateQuestion(nodes, config.task, node1, node2, depth, Answer);
            })
            .catch(error => console.error("Error fetching subtree:", error));
        });
}

// 問題カウント
// 現在の問題番号をローカルストレージから取得（初期値は0）
let currentQuestionIndex = parseInt(localStorage.getItem("currentQuestionIndex"), 10) || 0;

// 現在の問題番号を更新する関数
function updateQuestionCounter(currentIndex, totalQuestions) {
    const questionCounter = document.getElementById("questionCounter");
    if (questionCounter) {
        questionCounter.textContent = `${currentIndex + 1} / ${totalQuestions} 問目`;
    }
}

// 「次へ」ボタンのクリックイベント
document.getElementById("nextButton").addEventListener("click", function () {

    const currentURL = new URL(window.location.href);
    const task = config.task;
    const taskOrder = JSON.parse(localStorage.getItem(`taskOrder_${task}`));
    const currentTaskNum = parseInt(currentURL.searchParams.get("tasknum"), 10) || config.tasknum;

    let score = parseInt(localStorage.getItem("score"), 10) || 0;
    let taskResults = JSON.parse(localStorage.getItem("taskResults")) || [];

    //const currentIndex = taskOrder.indexOf(Number(currentTaskNum));
    const currentIndex = parseInt(localStorage.getItem("currentQuestionIndex"), 10) || 0;
    const nextIndex = currentIndex + 1;
    localStorage.setItem("currentQuestionIndex", nextIndex);

    const answerInput = document.getElementById("answerInput");
    const userAnswer = answerInput ? answerInput.value.trim() : null;

    updateQuestionCounter(currentIndex, config.task.startsWith("ex-") ? 5 : 40);

    const totalQuestions = config.task.startsWith("ex-") ? 5 : 40;
    if (nextIndex >= totalQuestions) {
        displayResults(score, taskResults);
        //alert(`終了です。\n合計得点: ${score} / 40`);
        localStorage.removeItem("currentQuestionIndex");
        localStorage.removeItem(`taskOrder_${config.task}`);
        localStorage.removeItem("score");
        localStorage.removeItem("taskResults");
        return;
    }

    const nextTaskNum = taskOrder[nextIndex];
    currentURL.searchParams.set("tasknum", nextTaskNum);

    window.location.href = currentURL.toString();
    /*//  5秒のラグを挿入
    setTimeout(() => {
        window.location.href = currentURL.toString();
    }, 5000);*/
});

// 3. 2. 1のカウントダウンを表示してからタスクを開始する関数
function showCountdownThenStart(task) {
    const questionText = document.getElementById("questionText");
    const questionArea = document.getElementById("questionArea");
    const countdownNumbers = [3, 2, 1];

    let index = 0;
    questionArea.style.display = "block"; // カウントダウン中も表示

    const countdownInterval = setInterval(() => {
        if (index < countdownNumbers.length) {
            questionText.textContent = countdownNumbers[index];
            index++;
        } else {
            clearInterval(countdownInterval);
            questionText.textContent = "開始！";
            setTimeout(() => {
                initializeforTask(task); // タスク本体を表示
            }, 500); // 0.5秒だけ「開始！」を見せてから次へ
        }
    }, 1000); // 1秒ごとにカウント
}

/*(function initializeTaskOrderIfNeeded() {
    const currentURL = new URL(window.location.href);
    const task = currentURL.searchParams.get("task");
    const tasknumParam = currentURL.searchParams.get("tasknum");
    const taskKey = `taskOrder_${task}`;

    if (tasknumParam === null) {
        // 例題なら常に tasknum=0 で開始
        if (task && task.startsWith("ex-")) {
            if (!currentURL.searchParams.has("tasknum")) {
                currentURL.searchParams.set("tasknum", 0);
                window.location.href = currentURL.toString();
            }
            return;
        }
        const taskCount = task.startsWith("ex-") ? 5 : 40;
        const fullSet = Array.from({ length: taskCount }, (_, i) => i);
        const currentTaskNum = Math.floor(Math.random() * 40);
        const filtered = fullSet.filter(i => i !== currentTaskNum);
        const shuffled = filtered.sort(() => Math.random() - 0.5);
        //const taskOrder = [currentTaskNum, ...shuffled];
        const taskOrder = task.startsWith("ex-") ? fullSet : [currentTaskNum, ...shuffled];

        //console.log(`初期タスク順 : ${taskOrder}, ${taskOrder.length}`);
        localStorage.setItem(taskKey, JSON.stringify(taskOrder));
        localStorage.setItem("score", "0");
        localStorage.setItem("taskResults", JSON.stringify([]));
        localStorage.setItem("currentQuestionIndex", "0");
        if (currentURL.searchParams.has("task")) {
            currentURL.searchParams.set("tasknum", currentTaskNum);
            window.location.href = currentURL.toString();
        }
    }
})();*/

(function initializeTaskOrderIfNeeded() {
    const currentURL = new URL(window.location.href);
    const task = currentURL.searchParams.get("task");
    const tasknumParam = currentURL.searchParams.get("tasknum");
    const taskKey = `taskOrder_${task}`;

    const taskCount = task && task.startsWith("ex-") ? 5 : 40;
    const fullSet = Array.from({ length: taskCount }, (_, i) => i);

    // taskOrderが未設定なら保存（例題でも本番でも共通）
    if (!localStorage.getItem(taskKey)) {
        const currentTaskNum = task && task.startsWith("ex-") ? 0 : Math.floor(Math.random() * 40);
        const taskOrder = task.startsWith("ex-") ? fullSet : [currentTaskNum, ...fullSet.filter(i => i !== currentTaskNum).sort(() => Math.random() - 0.5)];

        localStorage.setItem(taskKey, JSON.stringify(taskOrder));
        localStorage.setItem("score", "0");
        localStorage.setItem("taskResults", JSON.stringify([]));
        localStorage.setItem("currentQuestionIndex", "0");

        // tasknum を URL にセットしてリロード
        if (task && !currentURL.searchParams.has("tasknum")) {
            currentURL.searchParams.set("tasknum", currentTaskNum);
            window.location.href = currentURL.toString();
        }
    }

    // 既にtaskOrderがあり、tasknumがまだないときのみtasknumを追加
    if (tasknumParam === null && task) {
        const currentTaskNum = task.startsWith("ex-") ? 0 : Math.floor(Math.random() * 40);
        currentURL.searchParams.set("tasknum", currentTaskNum);
        window.location.href = currentURL.toString();
    }
})();

document.addEventListener("DOMContentLoaded", function () {
    updateQuestionCounter(currentQuestionIndex, config.task.startsWith("ex-") ? 5 : 40); // 初期表示
});

// 初期データを `/data` エンドポイントから取得し、描画
fetch('/data', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ n: config.topNode }),
})
    .then(response => response.json())
    .then(data => {
        const root = data.life;
        const leafNodes = data.leaf_nodes;

        // 初期グラフ描画
        drawChart(root);

        // `topNode` が指定されている場合に特定のサブツリーを取得して描画
        if (config.task) {
            //initializeforTask(config.task);
            const currentQuestionIndex = parseInt(localStorage.getItem("currentQuestionIndex"), 10) || 0;
            if (currentQuestionIndex === 0) {
                showCountdownThenStart(config.task); // 最初の1問目のみカウントダウン
            } else {
                initializeforTask(config.task); // 2問目以降はすぐに開始
            }
        }
    })
    .catch(error => console.error("Error fetching initial data:", error));

function drawChart(root) {
    var nodes = partition.nodes(root);
    subtreeNodeNames = nodes.map(d => d.name);  // 表示されるサブツリー内のノード名を保存
    
    // mainSvg を描画する処理
    const mainSvg = d3.select("#mainSvg");
    
    // copySvg を作成
    const copySvg = d3.select("body")
        .append("svg")
        .attr("id", "copySvg")
        .attr("width", mainSvg.attr("width"))
        .attr("height", mainSvg.attr("height"))
        .style("position", "absolute")
        .style("top", "20%")  // 任意のオフセット
        .style("left", "20%")
        .style("opacity", 0);
    
    // 初回コピー
    copyMainSvgToCopySvg();
    
    // Append image to the container
    d3.select("#overview").append("img")
        .attr("src", "/static/images/overview_biota.png")
        .attr("width", 200)
        .attr("height", 200)
        .style("position", "absolute")
        .style("top", "0px")
        .style("left", "0px");
    
    var overviewX = d3.scale.linear().range([0, 2 * Math.PI]);
    var overviewY = d3.scale.linear().range([0, overmaxradius * 5 / (maxdepth+1)]);
    
    
    var overviewArc = d3.svg.arc()
        .startAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x))); })
        .endAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x + d.dx))); })
        .innerRadius(function(d) { return Math.max(0, overviewY(d.y)); })
        .outerRadius(function(d) { return Math.max(0, overviewY(d.y + d.dy)); });
    
    // Create the SVG element on top of the canvas
    overviewSvg = d3.select("#overview").append("svg")
        .attr("width", overwidth)
        .attr("height", overheight)
        .style("position", "absolute")
        .style("top", "0px")
        .style("left", "0px")
        .append("g")
        .attr("transform", "translate(" + (overwidth / 2) + "," + (overheight / 2) + ")");
    
    // 合体ノードには透明度を設定
    var path = svg.selectAll("path")
        .data(nodes)
        .enter().append("path")
        .attr("d", arc)
        .attr("data-id", d => d.n)
        .style("fill", function(d) {
            if (config.colorChange) {
                return fillColor(d);
            }
            return computeNodeColor(d, d.depth, 0, 2*Math.PI);
        })
        .style("opacity", function(d) {
            return d.is_merged ? 0.3 : 1;
        });
        
    // Non-clickable paths
    var nonClickablePaths = path.filter(function(d) {
        var r = y(d.y + d.dy / 2); // Average radius of the arc
        var theta = x(d.x + d.dx) - x(d.x); // Angle in radians
        return r * theta < sizeCriterion;
    });
    
    // Clickable paths
    var clickablePaths = path.filter(function(d) {
        return !nonClickablePaths.data().includes(d);
    });
    
    clickablePaths.on("click", handleNodeClick)
                .on("mouseover", mouseover)
                .on("mouseout", mouseout);

    // Initialize overviewSvg with initialNodes
    overviewSvg.selectAll("path")
        .data(nodes)
        .enter().append("path")
        .attr("d", overviewArc)
        .style("fill", function(d) {
            // メインSVGからノードの色を取得
            const mainPath = svg.select(`path[data-id="${d.n}"]`);
            if (!mainPath.empty()) {
                d.overviewColor = mainPath.style("fill");
                return d.overviewColor;
            }
            /*
            if (config.colorChange) {
                d.overviewColor = fillColor(d)
                return d.overviewColor;
            }
            d.overviewColor = computeNodeColor(d, d.depth, 0, 2*Math.PI); 
            return d.overviewColor;*/
        });
    if (!config.task) {
        var drag = initializeDrag(nodes, arc, null, root=NaN); // ドラッグ設定を適用
        draggableBar.call(drag); // ドラッグ可能なバーに適用
        updateLabels(nodes, arc); // ラベルを初期描画
        updateNodeCount(nodes);
    }
    }

var previousTopNode = null;
var previousClickDepth = 0;
var pathList = [];
var previousStartAngle = 0; // 追加：前回の開始角度
var previousEndAngle = 2 * Math.PI; // 追加：前回の終了角度

function fillColor(d) {
    let distance = y(d.y);
    let angle = x(d.x);
    let [L, a, b] = polarToCIELab(distance, angle, maxradius);
    return LabToHex(L, a, b);
    }

function computeNodeColor(d, depth, startAngle, endAngle) {
    let distance = maxradius * depth/maxdepth;
    let normalizedAngle = d.x + d.dx / 2;
    //let angle = normalizedAngle * (overendAngle - overstartAngle) + overstartAngle;
    let angle = normalizedAngle * (endAngle - startAngle) + startAngle;
    let [L, a, b] = polarToCIELab(distance, angle, maxradius);
    return LabToHex(L, a, b);
}

function click(d) {
    var startTime = performance.now();
    var clickedNodeParent = d.parent;
    // 既存の画像を消去
    //imgSvg.selectAll("image").style("display", "none");
    /*try {
        imgSvg.selectAll("image").remove();
    } catch (error) {
        console.error("Error removing images:", error);
    }*/
    //console.log("Clicked Node", d.name);
    // クリックされたノードが辞書に存在するか確認
    let infoPanel = d3.select("#info-panel");
    let nodeName = d3.select("#node-name");
    let nodeImage = d3.select("#node-image");
    let nodeWiki = d3.select("#node-wiki");
    let gridContainer = d3.select("#grid-container");

    // 既存の情報をクリア
    nodeName.text("");
    nodeImage.style("display", "none").attr("src", "");
    nodeWiki.style("display", "none").attr("href", "");
    gridContainer.html("").style("display", "none"); // グリッドの初期化
    

    
    // クリックノードの真のルートノードからの深さを再帰的に求める
    function getNodeDepth(node, previousDepth) {
        //console.log(`${node.name}の前のクリック深さ：${previousDepth}`);
        if (d.depth === 0 && previousTopNode) {
            //console.log(`親ノードクリック：${d.name}`);
            return previousDepth - 1;
        }
        if (!node.parent) {
            //console.log(`${node.name}はルート`);
            return previousDepth - 1;
        }
        return getNodeDepth(node.parent, previousDepth + 1);
        }
    var clicknodeDepth = getNodeDepth(d, previousClickDepth);
    //console.log(`${d.name}をクリック：${previousClickDepth}→${clicknodeDepth}`);
    
    if (d.depth === 0 && previousTopNode) {
    pathList.pop();
    } else {
    // クリックノードの祖先ノードを含む配列を作成
    pathList = getAncestors(d, pathList);
    }
    updatePathDisplay(); // パスを更新して画面に表示
    
    if (d.depth === 0 && previousTopNode) {
        // 既存の path の色を保存
        const colorMap = {};
        svg.selectAll("path").each(function(d) {
            // 各ノードの名前をキーに現在の色を保存
            colorMap[d.name] = d3.select(this).style("fill");
        });
        // サーバーからデータ取得
        fetch('/parentclick', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ n: d.n })
        })
            .then(response => response.json())
            .then(data => {
                const subtree = data.newtree;
                const parentNode = data.parent;
    
                // グラフのクリア
                svg.selectAll("path").remove();
                svg.selectAll("text").remove();
    
                // ノード生成
                const nodes = partition.nodes(subtree).filter(d => d.depth >= 0);
                subtreeNodeNames = nodes.map(d => d.name);
    
                // アニメーションの有無に基づく処理
                if (config.animation) {
                    handleAnimation(nodes, colorMap, parentNode, d);
                } else {
                    handleImmediateUpdate(nodes, colorMap, parentNode, d);
                }
                previousClickDepth = clicknodeDepth;
            });
        
            function handleAnimation(nodes, colorMap, parentNode, clickedNode) {
                let previousNode = nodes.find(n => n.name === previousTopNode.name);
                if (!previousNode) return;
            
                const n_x = previousNode.x;
                const n_dx = previousNode.dx;
                const overstartAngle = (previousStartAngle * (n_x + n_dx) - previousEndAngle * n_x) / n_dx;
                const overendAngle = (previousStartAngle * (n_x + n_dx - 1) - previousEndAngle * (n_x - 1)) / n_dx;
            
                // ノード描画
                const path = svg.selectAll("path").data(nodes).enter().append("path")
                    .attr("d", arc)
                    .style("fill", d => !config.colorChange
                        ? computeNodeColor(d, d.depth + clicknodeDepth, overstartAngle, overendAngle)
                        : colorMap[d.name] || "#000")
                    .style("opacity", d => (d.is_merged ? 0.3 : 1));
            
                // 親ノードとクリック可能ノードを設定
                makePathsClickable(path, clickedNode);
            
                // Overview 更新
                updateOverview(nodes, overstartAngle, overendAngle);
            
                x.domain([n_x, n_x+n_dx]);
                // アニメーション付きトランジション
                svg.transition()
                    //.delay(6000)
                    .duration(4000)
                    .tween("scale", function() {
                        let targetDepth = Math.min(d.y + 5 * d.dy, 1);
                        let //xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
                            xd = d3.interpolate(x.domain(), [0, 1]),
                            yd = d3.interpolate(y.domain(), [d.y, 1]),
                            yr = d3.interpolate(y.range(), [d.y ? 20 : 0, maxradius]);
                        return function(t) {
                            //let adjustedT = t < 0.4 ? 2.5 * t : 1;
                            x.domain(xd(t));
                            y.domain(yd(t)).range(yr(t));
                        };
                    })
                    .selectAll("path").attrTween("d", function(d) { return function() { return arc(d); }; })
                    .styleTween("fill", function(d) {
                        if (config.colorChange) { // 条件付きで適用
                            //const initialColor = colorMap[d.name] || "#fff";
                            const initialColor = d.name === clickedNode.name ? "#fff" : (colorMap[d.name] || "#fff");
                            return function(t) {
                                return d3.interpolateLab(initialColor, fillColor(d))(t);
                            };
                        } else {
                            return null; // 適用しない場合はnullを返す
                        }
                    })
                    .each("end", function(e, i) {
                        if(i===0) {
                            finalizeUpdate(nodes, parentNode)
                        }
                    });
                    previousTopNode = clickedNode;
                    previousClickDepth = clicknodeDepth;
                    previousStartAngle = overstartAngle;
                    previousEndAngle = overendAngle;
            }
            
            function handleImmediateUpdate(nodes, colorMap, parentNode, clickedNode) {
                let previousNode = nodes.find(n => n.name === previousTopNode.name);
                if (!previousNode) return;
            
                const n_x = previousNode.x;
                const n_dx = previousNode.dx;
                const overstartAngle = (previousStartAngle * (n_x + n_dx) - previousEndAngle * n_x) / n_dx;
                const overendAngle = (previousStartAngle * (n_x + n_dx - 1) - previousEndAngle * (n_x - 1)) / n_dx;
            
                // ノード描画
                const path = svg.selectAll("path").data(nodes).enter().append("path")
                    .attr("d", arc)
                    .style("fill", function(d) {
                        if (config.colorChange) {
                            return fillColor(d);
                        }
                        return computeNodeColor(d, d.depth+clicknodeDepth, overstartAngle, overendAngle);
                    })
                    .style("opacity", d => (d.is_merged ? 0.3 : 1));
                
            
                // 親ノードとクリック可能ノードを設定
                makePathsClickable(path, clickedNode);
            
                // Overview 更新
                updateOverview(nodes, overstartAngle, overendAngle);
            
                // ラベル更新やドラッグ適用
                finalizeUpdate(nodes, parentNode);
                previousTopNode = clickedNode;
                previousClickDepth = clicknodeDepth;
                previousStartAngle = overstartAngle;
                previousEndAngle = overendAngle;
            }

            function makePathsClickable(path, clickedNode) {
                const clickablePaths = path.filter(d => {
                    const r = y(d.y + d.dy / 2);
                    const theta = x(d.x + d.dx) - x(d.x);
                    return r * theta >= sizeCriterion || d === clickedNode.parent; // クリック可能ノードをフィルタリング
                });
            
                clickablePaths.on("click", handleNodeClick)
                    .on("mouseover", mouseover)
                    .on("mouseout", mouseout);
            }
            
            function updateOverview(nodes, overstartAngle, overendAngle) {
                overviewX = d3.scale.linear().range([overstartAngle, overendAngle]);
                overviewY = d3.scale.linear().range([
                    overmaxradius * clicknodeDepth / maxdepth,
                    overmaxradius * (clicknodeDepth + 4 < maxdepth ? clicknodeDepth + 4 : maxdepth) / maxdepth
                ]);
            
                const overviewArc = d3.svg.arc()
                    .startAngle(d => Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x))))
                    .endAngle(d => Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x + d.dx))))
                    .innerRadius(d => Math.max(0, overviewY(d.y)))
                    .outerRadius(d => Math.max(0, overviewY(d.y + d.dy)));
            
                const overviewSvg = d3.select("#overview").select("svg").select("g");
            
                overviewSvg.selectAll("path").remove();
            
                overviewSvg.selectAll("path")
                    .data(nodes)
                    .enter().append("path")
                    .attr("d", overviewArc)
                    .style("fill", function(d) {
                        if (config.colorChange) {
                            d.overviewColor = fillColor(d);
                            return d.overviewColor;
                        }
                        d.overviewColor = colorMap[d.name] || computeNodeColor(d, d.depth+clicknodeDepth, overstartAngle, overendAngle); 
                        return d.overviewColor;
                    })
                    .style("opacity", d => (d.is_merged ? 0.3 : 1));
            }
    } else {
        // ノードクリック
        if (config.animation) {
            // 動的に dispatch のステップを生成
            var depthSteps = [];
            var nodeStack = [];
            var currentNode = d;
            while (currentNode.depth > 1) {
                depthSteps.unshift(currentNode.name);
                nodeStack.unshift(currentNode);
                currentNode = currentNode.parent;
            }
            depthSteps.unshift(currentNode.name);  // ルートノードを最後に追加
            nodeStack.unshift(currentNode);  // ルートノードを最後に追加
            // ステップを持つ dispatch を生成
            //var dispatch = d3.dispatch.apply(null, depthSteps.map(name => `event.${name}`));
            var dispatch = d3.dispatch("step");
            
            // 各ステップに対してトランジション処理を設定
            let currentIndex = 0;
            const preClickDepth = previousClickDepth;
            
            dispatch.on("step", function(prevStartAngle, prevEndAngle) {
                if (currentIndex >= nodeStack.length) return; // すべてのノードが終了したら停止
            
                const currentNode = nodeStack[currentIndex];
                const nextNode = nodeStack[currentIndex + 1];
                const nextNodeName = nextNode ? nextNode.name : null;
            
                // performClickActionを呼び出し、次のステップの処理を設定
                performClickAction(currentNode, dispatch, "step", prevStartAngle, prevEndAngle, nextNodeName, preClickDepth);
            
                // インデックスを進める
                currentIndex += 1;
            });
            
            // 最初のステップを呼び出す
            dispatch.step();
        } else {
        // アニメなしver(subtree)
        var startAngle = x(d.x);
        var endAngle = x(d.x + d.dx);
        // 中心角度の計算
        const opposingAngle = (startAngle + endAngle) / 2 - Math.PI;
        offset -= opposingAngle; // クリックによるオフセットを調整
        console.log(`遷移後のoffset: ${offset}`);
        const colorMap = {};
        svg.selectAll("path").each(function(d) {
            // 各ノードの名前をキーに現在の色を保存
            colorMap[d.name] = d3.select(this).style("fill");
        });
        fetch('/subtree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ n: d.n })
        })
        .then(response => response.json())
        .then(data => {
            const subtree = data.newtree;
            const parentNode = data.parent;
    
            // グラフを即座に更新
            svg.selectAll("path").remove();
            svg.selectAll("text").remove();
    
            // 座標範囲をリセット
            x.range([0, 2 * Math.PI]);
            y.range([0, maxradius]);
    
            const nodes = partition.nodes(subtree);
    
            var overstartAngle = previousStartAngle + (previousEndAngle - previousStartAngle) * startAngle/(2*Math.PI);
            var overendAngle = previousStartAngle + (previousEndAngle - previousStartAngle) * endAngle/(2*Math.PI);

            // ノードの描画
            const path = svg.selectAll("path").data(nodes).enter().append("path")
                .attr("d", arc)
                .attr("data-id", d => d.n)
                .style("fill", function(d) {
                    if (config.colorChange) {
                        return fillColor(d);
                    }
                    return colorMap[d.name] || computeNodeColor(d, d.depth+clicknodeDepth, overstartAngle, overendAngle);
                })
                .style("opacity", d => (d.is_merged ? 0.3 : 1));
    
            // クリック可能なパスを設定
            const clickablePaths = path.filter(d => {
                const r = y(d.y + d.dy / 2);
                const theta = x(d.x + d.dx) - x(d.x);
                return r * theta >= sizeCriterion || d === d.parent;
            });
    
            clickablePaths.on("click", handleNodeClick)
                .on("mouseover", mouseover)
                .on("mouseout", mouseout);

            previousStartAngle = overstartAngle; // 追加：前回の開始角度を保存
            previousEndAngle = overendAngle; // 追加：前回の終了角度を保存
            overviewX = d3.scale.linear().range([overstartAngle, overendAngle]);
            overviewY = d3.scale.linear().range([
                overmaxradius * clicknodeDepth / maxdepth,
                overmaxradius * (clicknodeDepth + 4 < maxdepth ? clicknodeDepth + 4 : maxdepth) / maxdepth
            ]);
        
            var overviewArc = d3.svg.arc()
                .startAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x))); })
                .endAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x + d.dx))); })
                .innerRadius(function(d) { return Math.max(0, overviewY(d.y)); })
                .outerRadius(function(d) { return Math.max(0, overviewY(d.y + d.dy)); });
        
            var overviewSvg = d3.select("#overview").select("svg").select("g");
        
            overviewSvg.selectAll("path").remove();
        
            overviewSvg.selectAll("path")
                .data(nodes)
                .enter().append("path")
                .attr("d", overviewArc)
                .style("fill", function(d) {
                    const mainPath = svg.select(`path[data-id="${d.n}"]`);
                    if (!mainPath.empty()) {
                        d.overviewColor = mainPath.style("fill");
                        return d.overviewColor;
                    }
                });
        
            previousTopNode = d;
            updateLabels(nodes, arc);
            previousClickDepth = clicknodeDepth;
            finalizeUpdate(nodes, parentNode);
        })}
    }
    
    function performClickAction(d, dispatch, stepName, prevStartAngle, prevEndAngle, nextNodeName, predepth) {
        var startTime = performance.now();
        // 前のステップの角度範囲を引き継ぐか、新しい範囲を設
        var startAngle = prevStartAngle !== undefined ? prevStartAngle : x(d.x);
        var endAngle = prevEndAngle !== undefined ? prevEndAngle : x(d.x + d.dx);
        // 中心角度の計算
        const opposingAngle = (startAngle + endAngle) / 2 - Math.PI;
        // クリック時の offset 更新
        var clickedNodeParent = d.parent;
        var stepdepth = predepth + d.depth;
        const colorMap = {};
        svg.selectAll("path").each(function(d) {
            // 各ノードの名前をキーに現在の色を保存
            colorMap[d.name] = d3.select(this).style("fill");
        });
        // Copy SVG の更新
        const copySvg = d3.select("#copySvg");
        copySvg.html(d3.select("#mainSvg").html()); // mainSvg をコピー
        
        // Copy SVG 内のテキストを削除
        copySvg.selectAll("text").remove();
        
        // ノードに対するその他のクリック処理（描画の更新など）
        fetch('/subtree', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ n: d.n })
        })
        //.then(response => response.json())
        .then(response => {
            
            const contentLength = response.headers.get('content-length');
            //console.log(`${d.name}, Response size: ${contentLength} bytes`);  // 受信データのサイズを表示
            
            return response.json();
        })
        .then(data => {
            var subtree = data.newtree;
            var parentNode = data.parent;
            var endTime = performance.now();
            var timeTaken = endTime - startTime;
            //console.log(`Time taken: ${timeTaken.toFixed(2)} ms`);
            // クリック前の表示をキャンバスに保存
            var svgElement = document.querySelector("#mainSvg");
            offset -= opposingAngle;

            // テキスト要素を一時的に削除
            var textElements = svgElement.querySelectorAll("text");
            textElements.forEach(function(text) {
                text.style.display = "none";
            });
        
            svg.selectAll("path").remove();
            svg.selectAll("text").remove(); // ラベルをクリア
            /*
            x.range([startAngle-opposingAngle, endAngle-opposingAngle]);
            y.range([maxradius/5, maxradius*6/5]);*/
            //x.domain([0, 1]);
            var nodes =partition.nodes(subtree);
            var overstartAngle = previousStartAngle + (previousEndAngle - previousStartAngle) * startAngle/(2*Math.PI);
            var overendAngle = previousStartAngle + (previousEndAngle - previousStartAngle) * endAngle/(2*Math.PI);
            
            if (config.timing === "before") {
                var path = svg.selectAll("path").data(nodes).enter().append("path")
                    .attr("d", arc)
                    .style("fill", function(d) {
                        return fillColor(d);
                    })
                    .style("opacity", function(d) {
                        return d.is_merged ? 0.3 : 1;
                    });
            } else {
                var path = svg.selectAll("path").data(nodes).enter().append("path")
                    .attr("d", arc)
                    .style("fill", function(d) {
                        if (!config.colorChange) {
                            return colorMap[d.name] || computeNodeColor(d, d.depth+stepdepth, overstartAngle, overendAngle); 
                        }
                        return colorMap[d.name] || "#fff";
                    })
                    .style("opacity", function(d) {
                        return d.is_merged ? 0.3 : 1;
                    });
            }
        
            // Ensure the parent node is clickable
            var clickablePaths = path.filter(function(d) {
                var r = y(d.y + d.dy / 2);
                var theta = x(d.x + d.dx) - x(d.x);
                return r * theta >= sizeCriterion || d === clickedNodeParent; // クリックノードの親ノードはrが負の値のため
            });
        
            clickablePaths.on("click", handleNodeClick)
                .on("mouseover", mouseover)
                .on("mouseout", mouseout);
        
            previousStartAngle = overstartAngle; // 追加：前回の開始角度を保存
            previousEndAngle = overendAngle; // 追加：前回の終了角度を保存
            overviewX = d3.scale.linear().range([overstartAngle, overendAngle]);
            overviewY = d3.scale.linear().range([
                overmaxradius * stepdepth / maxdepth,
                overmaxradius * (stepdepth + 4 < maxdepth ? stepdepth + 4 : maxdepth) / maxdepth
            ]);
        
            var overviewArc = d3.svg.arc()
                .startAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x))); })
                .endAngle(function(d) { return Math.PI/2 - Math.max(0, Math.min(2 * Math.PI, overviewX(d.x + d.dx))); })
                .innerRadius(function(d) { return Math.max(0, overviewY(d.y)); })
                .outerRadius(function(d) { return Math.max(0, overviewY(d.y + d.dy)); });
        
            var overviewSvg = d3.select("#overview").select("svg").select("g");
        
            overviewSvg.selectAll("path").remove();
        
            overviewSvg.selectAll("path")
                .data(nodes)
                .enter().append("path")
                .attr("d", overviewArc)
                .style("fill", function(d) {
                    if (config.colorChange) {
                        d.overviewColor = fillColor(d)
                        return d.overviewColor;
                    }
                    d.overviewColor = colorMap[d.name] || computeNodeColor(d, d.depth+stepdepth, overstartAngle, overendAngle); 
                    return d.overviewColor;
                });
        
            x.range([startAngle-opposingAngle, endAngle-opposingAngle]);
            y.range([maxradius/5, maxradius*6/5]);
            previousTopNode = d;
        
            // 遷移スピードEase-InOutで設定
            function sigmoidEase(t) {
                const a = 3/4;
                const k = 8; // スケール係数
                let sig = 1 / (1 + Math.exp(-a * k * (t - 0.5))); // シグモイド関数
                const maxSig = 1 / (1 + Math.exp(-a * 4)); // sigmoid(4) の値
                const minSig = 1 / (1 + Math.exp(a * 4));
                //return (sig - minSig) / (maxSig - minSig); // [0, 1] にスケーリング
                return (sig - minSig) / (maxSig - minSig);
            }
        
            // Copy SVG の表示と透明度のアニメーション
            d3.select("#copySvg")
                .style("opacity", 0.3)
                .transition()
                .duration(3000)
                .style("opacity", 0);

                tooltip.style("visibility", "hidden");
            
                svg.transition()
                    //.delay(6000)
                    .duration(3000)
                    .tween("scale", function() {
                        let xr = d3.interpolate(x.range(), [0, 2 * Math.PI]),
                            yr = d3.interpolate(y.range(), [0, maxradius]);
                
                        return function(t) {
                            const easedT = config.ease ? sigmoidEase(t) : t;  
                            x.range(xr(easedT));
                            y.range(yr(easedT));
                        };
                    })
                    .selectAll("path")
                    .attrTween("d", function(d) {
                        return function() { return arc(d); };
                    })
                    .styleTween("fill", function(d) {
                        if (!config.colorChange || config.timing == "before" || config.timing == "after") {
                            return null;
                        } else {
                            const initialColor = colorMap[d.name] || "#000";
                            return function(t) {
                                return d3.interpolateLab(initialColor, fillColor(d))(t);
                            };
                        }
                    })
                    .each("end", function(e, i) {
                        if (i === 0) {

                            if (config.timing === "after") {
                                path.style("fill", function(d) {
                                        return fillColor(d);
                                    })
                            }
                
                            // 次のノードの startAngle と endAngle を求める
                            var nextStartAngle, nextEndAngle;
                            if (nextNodeName) {
                                const nextNode = nodes.find(n => n.name === nextNodeName);
                                if (nextNode) {
                                    nextStartAngle = x(nextNode.x);
                                    nextEndAngle = x(nextNode.x + nextNode.dx);
                                    // ★ offset を考慮して角度を調整
                                    //nextStartAngle -= offset;
                                    //nextEndAngle -= offset;
                                }
                            } else {
                                finalizeUpdate(nodes, parentNode)
                            }
                
                            // 次のステップ（固定の step イベント）を呼び出し
                            dispatch.step(nextStartAngle, nextEndAngle);
                            /*
                            // トランジション終了後にクリックとホバーを再有効化
                            svg.selectAll("path")
                                .style("pointer-events", "auto")
                                .on("click", handleNodeClick)
                                .on("mouseover", mouseover)
                                .on("mouseout", mouseout);*/
                        }
                    });

            subtreeNodeNames = nodes.map(d => d.name);
            updateNodeCount(nodes);
            previousClickDepth = stepdepth; // clicknodeDepth
            //console.log(`${d.name}クリック後の深さ：${previousClickDepth}`);
        })
        .catch(error => console.error("Error fetching subtree data:", error));
        } // performClickAction 終了
        function finalizeUpdate(nodes, parentNode) {
            if (imageMap[d.n]) {
                drawCircularIcons(d, nodes);
            } 
            if (parentNode) {
                parentNode.depth = 0;
                parentNode.x = 0;
                parentNode.dx = 1;
                parentNode.y = 0;
                parentNode.dy = 1;
        
                const parentY = d3.scale.linear().range([0, 20]);
                svg.append("path")
                    .datum(parentNode)
                    .attr("class", "parentNodeArc")
                    .attr("d", d => {
                        const arcParent = d3.svg.arc()
                            .startAngle(d => Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, x(d.x))))
                            .endAngle(d => Math.PI / 2 - Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))))
                            .innerRadius(d => Math.max(0, parentY(d.y)))
                            .outerRadius(d => Math.max(0, parentY(d.y + d.dy)));
                        return arcParent(d);
                    })
                    .style("fill", "gray")
                    .style("opacity", 0.5)
                    .on("click", handleNodeClick)
                    .on("mouseover", mouseover)
                    .on("mouseout", mouseout);
            }
            // ドラッグバーを追加
            var drag = initializeDrag(nodes, arc, parentNode, d); // ドラッグ設定を適用
            draggableBar.call(drag); // ドラッグバーに適用
        
            // ラベル再描画
            updateLabels(nodes, arc);
            updateNodeCount(nodes);
        } 
    } // Click関数終了
    
function getDeepestAncestorAngle(ancestors) {
    let deepest = null;
    svg.selectAll("path").each(function(d) {
        if (ancestors.includes(d.name)) {
            if (!deepest || d.depth > deepest.depth) {
                deepest = d;
            }
        }
    });
    if (!deepest) return Math.PI / 2; // デフォルト角度
    const angle = x(deepest.x + deepest.dx / 2);
    return angle;
}
    

    // ノードのクリック処理
function handleNodeClick(d) {
    if (config.interaction) {
        // 通常のクリック処理（ズームインなど）
        return click(d);
    } else {
        // 解答としてクリックされたノードを反映
        const answerInput = document.getElementById("answerInput");
        if (answerInput) {
            answerInput.value = d.n;
        }
    }
}

// mainSvg の内容を copySvg にコピーする関数
function copyMainSvgToCopySvg() {
    const mainSvg = d3.select("#mainSvg");
    const copySvg = d3.select("#copySvg");
    
    // copySvg をクリア
    copySvg.html("");
    
    // mainSvg の内容をコピー
    copySvg.node().innerHTML = mainSvg.node().innerHTML;
    
    // copySvg の透明度を初期値に設定
    copySvg.style("opacity", 0.5);
    }

// ancestors のノードを強調表示
function highlightAncestors(ancestors) {
    // すべてのノードの太枠スタイルをリセット
    svg.selectAll("path")
        .style("stroke", null)
        .style("stroke-width", null);
    // メッセージをクリア
    document.getElementById("ancestorMessage").innerText = "";
    
    // ancestors内かつサブツリー内のノードを太枠で強調
    let foundInSubtree = false;
    ancestors.forEach(name => {
        if (subtreeNodeNames.includes(name)) {
            svg.selectAll("path")
                .filter(d => d.name === name)
                .style("stroke", boldStrokeStyle.stroke)
                .style("stroke-width", boldStrokeStyle["stroke-width"]);
            foundInSubtree = true;
        }
    });
    
    // ancestors のノードがサブツリー内にない場合、メッセージを表示
    if (!foundInSubtree) {
        document.getElementById("ancestorMessage").innerText = "先祖ノードはこのサブツリーにはありません";
    }
    }

// ノードの祖先を取得
function fetchAncestors(identifier) {
    let searchKey, searchValue;

    if (/^\d+$/.test(identifier)) { 
        // すべて数字なら `n` で検索
        searchKey = "n";
        searchValue = identifier;
    } else {
        // 数字以外が含まれるなら `name` で検索
        searchKey = "name";
        searchValue = identifier;
    }

    // 祖先情報を取得
    fetch('/ancestor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [searchKey]: searchValue }) // `name` または `n` を送信
    })
    .then(response => response.json())
    .then(data => {
        if (!data.ancestors || data.ancestors.length === 0) {
            alert("指定されたノードの祖先情報が見つかりませんでした。");
            return;
        }

        let selectedNodeData;

        if (/^\d+$/.test(identifier)) {
            // `n` の場合は `string` に変換して比較
            selectedNodeData = data.ancestors.find(node => String(node.n) === String(identifier));
        } else {
            // `name` の場合
            selectedNodeData = data.ancestors.find(node => node.name === identifier);
        }

        //console.log("選択されたノードのデータ:", selectedNodeData); // デバッグ用

        if (!selectedNodeData) {
            alert("選択されたノードの情報が見つかりませんでした。");
            return;
        }

        const ancestors = selectedNodeData.ancestors;
        document.getElementById('ancestorDisplay').innerText =
            `選択ノード: ${searchValue}, 先祖: ${ancestors.join(" -> ")}`;

        // ancestors のノードを強調表示
        highlightAncestors(ancestors);

        // 入力フィールドをリセット
        document.getElementById('searchInput').value = "";
        // ドロップダウンを非表示に
        document.getElementById('searchDropdown').style.display = "none";
    })
    .catch(error => console.error("Error fetching ancestors:", error));
}


// 検索候補を取得
function fetchSearchCandidates() {
    const query = document.getElementById('searchInput').value;
    
    // 部分一致候補を取得
    fetch('/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query })
    })
    .then(response => response.json())
    .then(data => {
        const dropdown = document.getElementById('searchDropdown');
        dropdown.innerHTML = ""; // ドロップダウンをリセット
    
        if (data.matches.length === 0) {
            dropdown.style.display = 'none';
            alert("該当するノードが見つかりません。");
            return;
        }
    
        // 候補をドロップダウンに追加
        data.matches.forEach(name => {
            const option = document.createElement('div');
            option.textContent = name;
            option.style.cursor = 'pointer';
            option.onclick = () => fetchAncestors(name); // 選択時に`/ancestor`へ送信
            dropdown.appendChild(option);
        });
    
        // ドロップダウンを表示
        dropdown.style.display = 'block';
    })
    .catch(error => console.error("Error fetching search candidates:", error));
    }

function updateNodeCount(nodes) {
    var visibleNodes = nodes.filter(function(d) {
        return isNodeVisible(d, x.domain(), y.domain());
    });
    d3.select("#nodeCount").text("Number of visible nodes: " + visibleNodes.length);
    }
    
function isDescendantOrSelf(node, ancestor) {
    if (node === ancestor) return true;
    while (node.parent) {
        node = node.parent;
        if (node === ancestor) return true;
    }
    return false;
    }
    
function getAncestors(node, path) {
    var ancestors = [];
    var current = node;  // nodeを直接更新しないようにするための変数
    while (current.parent.parent) {
        ancestors.unshift(current);
        current = current.parent;
    }
    // 前回のパスを基に、新しい祖先ノードを追加
    var updatedPath = path.concat(ancestors);
    return updatedPath;
    }
    
function updatePathDisplay() {
    var pathDisplay = d3.select("#pathDisplay");
    pathDisplay.selectAll("div").remove();
    // パスを8個ずつのチャンクに分割して表示
    var chunkSize = 8;
    for (var i = 0; i < pathList.length; i += chunkSize) {
        var chunk = pathList.slice(i, i + chunkSize);
        pathDisplay.append("div")
            .data(chunk)
            .text(function() {
                return chunk.map(function(d) { return d.name; }).join(" -> ");
            });
    }
    }

    function mouseover(d) {
        let nodeColor = d3.select(this).style("fill");
        let labColor = d3.lab(nodeColor);
        
        // Calculate r and theta
        var r = y(d.y + d.dy / 2); // Average radius of the arc
        var theta = x(d.x + d.dx) - x(d.x); // Angle in radians
        var rTheta = r * theta;
    
        let tooltipContent = "";
    
        if (imageMap[d.n]) {
            // 辞書から情報を取得
            let imgData = imageMap[d.n];
            // **名前の表示（ラテン語 + 英語 + 日本語）**
            tooltipContent += `<strong>${d.name}</strong><br>`;
            if (imgData.name_en) tooltipContent += `English: ${imgData.name_en}<br>`;
            if (imgData.name_jp) tooltipContent += `日本語: ${imgData.name_jp}<br>`;
    
            if (imgData.multiple_images) {
                tooltipContent += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;">`;
                // **複数画像をすべて表示**
                imgData.multiple_images.forEach(img => {
                    let imgSrc;
    
                    // `n` の場合は辞書から画像を取得
                    if (typeof img === "number" && imageMap[img] && imageMap[img].image) {
                        imgSrc = `/static/images/${imageMap[img].image}`;
                    } else {
                        imgSrc = `/static/images/${img}`;
                    }
    
                    tooltipContent += `<img src="${imgSrc}" alt="${d.name}" style="width: 130px; height: 100px; object-fit: cover;">`;
                });
    
                // Wikipedia のリンクを表示
                tooltipContent += `<br><a href="${imgData.wiki}" target="_blank">src: Wikipedia</a>`;
    
            } else {
                // **通常の 1 枚画像表示**
                tooltipContent += `<img src="/static/images/${imgData.image}" alt="${imgData.alt}" style="width: 200px; height: auto; display: block; margin-top: 5px;"><br>`;
                tooltipContent += `<a href="${imgData.wiki}" target="_blank">src: Wikipedia</a>`;
            }
        } else {
            // 通常のツールチップ内容
            tooltipContent += `Node: ${d.name}, ${d.n}<br>`;
            tooltipContent += `Value: ${d.value}<br>`;
            if (d.is_merged) {
                tooltipContent += `Merged count: ${d.merge_count}<br>`;
            }
            /*
            tooltipContent += `r: ${r.toFixed(2)}(${y(d.dy)}), θ: ${theta.toFixed(2)}<br>`;
            tooltipContent += `r * θ: ${rTheta.toFixed(2)}<br>`;
            tooltipContent += `Color (CIELab): ${labColor.toString()}<br>`;*/
        }
        
        tooltip.style("visibility", "visible").html(tooltipContent);
    
        if (rTheta >= sizeCriterion) {
            overviewSvg.selectAll("path")
            .filter(function(node) { return node.name === d.name; })
            .style("fill", "#ffffff");
        }
    }
    
    
function mouseout(d) {
    tooltip.style("visibility", "hidden");
    
    // Restore the color of the corresponding node on the overview
    var r = y(d.y + d.dy / 2); // Average radius of the arc
    var theta = x(d.x + d.dx) - x(d.x); // Angle in radians
    var rTheta = r * theta;
    if (rTheta >= sizeCriterion) {
        overviewSvg.selectAll("path")
        .filter(function(node) { return node.name === d.name; })
        .style("fill", function(node) { return node.overviewColor; });
    }
    }       
    
    svg.on("mousemove", function() {
    tooltip.style("top", (d3.event.pageY + 10) + "px")
           .style("left", (d3.event.pageX + 10) + "px");
    });
    
function polarToCIELab(distance, angle, maxDistance) {
    //let L = 100 * (1 - 3 * distance / (4 * maxDistance));
    let L = 90 * (1 - 3 * distance / (4 * maxDistance));
    let a = 160 * distance / maxDistance * Math.cos(angle);
    let b = 160 * distance / maxDistance * Math.sin(angle);
    return [L, a, b];
    }
    
function LabToHex(L, a, b) {
    let labColor = d3.lab(L, a, b);
    let rgbColor = labColor.rgb();
    return rgbColor.toString();
    }
    
function isNodeVisible(d, xDomain, yDomain) {
    return d.x >= xDomain[0] && (d.x + d.dx) <= xDomain[1] && d.y >= yDomain[0] && (d.y + d.dy) <= yDomain[1];
    }