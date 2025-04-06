/*const svg = window.svg;
if (!svg) {
    throw new Error("svgがまだ定義されていません");
}*/

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
        text: "{depth}層目で最も大きい扇形を持つノードをクリックしてください。",
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
        text: "★と⚫︎で、どちらが大きいですか？",
        onAnswer: (node) => {
            document.getElementById("answerInput").value = node.n;
        }
    },
    {
        id : "hierarchical",
        type: "click",
        text: "サブツリー内で、★と⚫︎の共通祖先は存在しますか？存在する場合は共通祖先の中で最も2つのノードに近い層のノードを選択してください。",
        onAnswer: (node) => {
            document.getElementById("answerInput").value = node.n;
        }
    }
];
let config = window.graphConfig || window.config || null;
console.log("config", window.graphConfig);

function updateLabelsForTask(nodes, nodeNames) {
    const svg = window.svg;
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
    const Question = questions.find(question => question.id === task);
    let answer;
    let isAnswered = false; // 回答済みフラグ

    if (task === "size1") {
        answer = AnswerSize1(ans_num); // 正解
        // 質問文を設定
        questionText.textContent = `${Question.text}`;
        // ラベルを更新
        updateLabelsForTask(nodes, [node1]);
    }
    if (task === "size2") {
        answer = String(ans_num);
        questionText.textContent = Question.text.replace("{depth}", depth);
        drawLayerCircles(depth);
    } 
    if (task === "size3") {
        answer = ans_num === 1 ? "1番目" : "それ以外";
        questionText.textContent = `${Question.text}`;
        updateLabelsForTask(nodes, [node1]);
    }
    if (task === "size4") {
        answer = String(ans_num);
        questionText.textContent = `${Question.text}`;
        updateLabelsForTask(nodes, [node1, node2]);
    }
    if (task === "hierarchical") {
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
    // タイマーで3秒後に次へ進む処理
    const timer = setTimeout(() => {
        if (!isAnswered) { // 未回答の場合のみ処理
            console.log("Time's up! Automatically moving to next task.");
            handleAnswerSubmission(answer, answerInput.value.trim());
            isAnswered = true; // 回答済みに設定
            triggerNextTask();
        }
    }, 100);

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

/*function AnswerSize2(nodes, depth) {
    // 指定の深さのノードをフィルタ
    const depthNodes = nodes.filter(d => d.depth === depth);
    if (depthNodes.length === 0) {
        console.warn(`No nodes found at depth ${depth}.`);
        return null;
    }

    // 最大の d.dx を持つノードを選ぶ
    const largestNode = depthNodes.reduce((max, node) => (node.dx > max.dx ? node : max), depthNodes[0]);
    return largestNode.name;
}*/

function drawLayerCircles(depth) {
    const svg = window.svg;
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

    // 40問終了時に結果を表示
    if (questionIndex + 1 === 40) {
        //displayResults(score, taskResults);
    }
}

function displayResults(score, taskResults) {
    /*
    const resultContainer = document.getElementById("resultContainer");
    resultContainer.innerHTML = "タスク結果";

    taskResults.forEach(result => {
        let resultText = document.createElement("p");
        resultText.textContent = `問 ${result.question}: ${result.result} YOU → ${result.userAnswer}, 正解 → ${result.correctAnswer}`;
        resultText.style.fontSize = "6px";
        resultContainer.appendChild(resultText);
    });

    let finalScore = document.createElement("h3");
    finalScore.textContent = `最終スコア: ${localStorage.getItem("score")}/40`;
    resultContainer.appendChild(finalScore);*/

    // CSV ダウンロードボタンを追加
    let downloadButton = document.createElement("button");
    downloadButton.textContent = "CSVをダウンロード";
    downloadButton.onclick = downloadCSV(taskResults);
}

function downloadCSV(taskResults) {
    let sortedResults = taskResults.sort((a, b) => a.question - b.question);
    let csvContent = "\ufeff" + "問題番号,あなたの回答,正解,結果,colorChange\n"; // UTF-8 BOMを追加
    
    sortedResults.forEach((result, index) => {
        let colorChange = (index < 20) ? 0 : 1; // 1~20個目は0、21~40個目は1
        csvContent += `${result.question},${result.userAnswer},${result.correctAnswer},${result.result},${colorChange}\n`;
    });
    /*
    let sortedResults = taskResults.sort((a, b) => a.question - b.question);
    let csvContent = "\ufeff" + "問題番号,あなたの回答,正解,結果\n"; // UTF-8 BOMを追加
    taskResults.forEach(result => {
        csvContent += `${result.question},${result.userAnswer},${result.correctAnswer},${result.result}\n`;
    });*/
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
            const svg = window.svg;
            const x = window.x;
            const y = window.y;
            const partition = window.partition;
            const arc = window.arc;
            const maxradius = window.maxradius;
        
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
            var clicknodeDepth = currentNode.depth;
        
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
        
                /*previousStartAngle = overstartAngle; // 追加：前回の開始角度を保存
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
                    });*/
                updateNodeCount(nodes);
                generateQuestion(nodes, config.task, node1, node2, depth, Answer);
            })
            .catch(error => console.error("Error fetching subtree:", error));
        });
}
/*// 初期データを `/data` エンドポイントから取得し、描画
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
        if (config.topNode) {
            //initializeGraphWithTopNode(config.topNode);
        }
        if (config.task) {
            initializeforTask(config.task);
        }
    })
    .catch(error => console.error("Error fetching initial data:", error));*/

// 問題カウント
// 現在の問題番号をローカルストレージから取得（初期値は0）
let currentQuestionIndex = parseInt(localStorage.getItem("currentQuestionIndex"), 10) || 0;

// 現在の問題番号を更新する関数
function updateQuestionCounter(currentIndex, totalQuestions = 40) {
    const questionCounter = document.getElementById("questionCounter");
    if (questionCounter) {
        questionCounter.textContent = `${currentIndex + 1} / ${totalQuestions} 問目`;
    }
}

document.getElementById("nextButton").addEventListener("click", function () {
    // 現在のURLを取得
    const currentURL = new URL(window.location.href);

    // `task` と `tasknum` を取得
    const task = config.task;
    let taskOrder;
    if (currentURL.searchParams.get("tasknum") !== null) {
        taskOrder = JSON.parse(localStorage.getItem(`taskOrder_${task}`))
    } else {
        taskOrder = [];
    }
    const currentTaskNum = parseInt(currentURL.searchParams.get("tasknum"), 10) || config.tasknum;
    //console.log(`現在のtasknum : ${currentTaskNum}`);
    let score = parseInt(localStorage.getItem("score"), 10) || 0;
    let taskResults = JSON.parse(localStorage.getItem("taskResults")) || [];

    // ランダムな順序が未生成の場合、初期化
    if (taskOrder.length === 0) {
        taskOrder = Array.from({ length: 40 }, (_, i) => i).sort(() => Math.random() - 0.5); // 0~39 をランダム順序で生成
        const index = taskOrder.indexOf(currentTaskNum);
        // 要素がリストに存在する場合
        if (index !== -1) {
            // 対象要素をリストから削除
            const [item] = taskOrder.splice(index, 1);
            // 対象要素をリストの先頭に追加
            taskOrder.unshift(item);
        }
        console.log(`初期タスク順 : ${taskOrder}, ${taskOrder.length}`);
        localStorage.setItem(`taskOrder_${task}`, JSON.stringify(taskOrder)); // ローカルストレージに保存
        localStorage.setItem("score", "0");
        localStorage.setItem("taskResults", JSON.stringify([]));
    }

    //console.log(`タスク順 : ${taskOrder}, ${taskOrder.length}`);

    const currentIndex = taskOrder.indexOf(Number(currentTaskNum));
    const nextIndex = currentIndex + 1;
    localStorage.setItem("currentQuestionIndex", nextIndex); // 新しい値を保存

    // 現在の回答の正誤判定
    const answerInput = document.getElementById("answerInput");
    const userAnswer = answerInput ? answerInput.value.trim() : null;
    updateQuestionCounter(currentIndex, 40);

    // すべてのタスクが完了した場合、終了メッセージを表示
    if (nextIndex > 39) {
        displayResults(score, taskResults);
        alert(`終了です。\n合計得点: ${parseInt(localStorage.getItem("score"), 10) || 0} / 40`);
        currentURL.searchParams.delete("tasknum");
        window.location.href = currentURL.toString();
        return;
    }

    const nextTaskNum = taskOrder[nextIndex];
    currentURL.searchParams.set("tasknum", nextTaskNum); // 次のタスク番号
    
    window.location.href = currentURL.toString();
});

// 初期ロード時に問題番号を設定
document.addEventListener("DOMContentLoaded", function () {
    updateQuestionCounter(currentQuestionIndex, 40); // 初期表示
});

export {
    questions,
    updateLabelsForTask,
    triggerNextTask,
    generateQuestion,
    AnswerSize1,
    drawLayerCircles,
    handleAnswerSubmission,
    displayResults,
    downloadCSV,
    initializeforTask,
    updateQuestionCounter
};