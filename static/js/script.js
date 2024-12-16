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
    .style("top", "150px")  // 任意のオフセット
    .style("left", "150px") // 任意のオフセット
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
    topNode: null
};

// クリッピングパスを追加して、maxradius以上の領域が表示されないようにする
svg.append("clipPath")
    .attr("id", "circleClip")
    .append("circle")
    .attr("r", maxradius);

// `clip-path` 属性を適用して円形にクリッピング
svg.attr("clip-path", "url(#circleClip)");

// ドラッグ可能なバー用の別SVG要素
var barSvg = d3.select("body").append("svg")
    .attr("id", "barSvg")
    .attr("width", width)
    .attr("height", height + 100)  // 高さを調整
    .style("position", "absolute")
    .style("top", `${mainSvgRect.top - 50}px`) 
    //.style("top", `${mainSvgRect.top + 750}px`) 
    .style("left", `${mainSvgRect.left}px`);

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

// ドラッグイベントの設定
function initializeDrag(nodes, arc, panrentNode) {
    return d3.behavior.drag()
        .on("dragstart", function () {
            svg.selectAll("text").style("visibility", "hidden"); // ラベルを非表示
        })
        .on("drag", function () {
            // d3.eventから座標を取得
            var mouseX = d3.event.x;
            var mouseY = d3.event.y;
            // 中心からの角度を計算（ラジアン）
            var angle = Math.atan2(mouseY - centerY, mouseX - centerX);
            // 正規化された角度を計算（0から1の範囲）
            var correctedAngle = angle + Math.PI / 2; // 角度の補正
            var normalizedAngle = (correctedAngle >= 0 ? correctedAngle : (2 * Math.PI + correctedAngle)) / (2 * Math.PI);
    
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
            updateLabels(nodes, arc);
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
            return d.is_merged ? d.merge_count : d.name;
        });
    }
// 初期化関数
function initializeGraphWithTopNode(topNode) {
    // 現在のグラフ情報から該当ノードを探索
    let currentNode = null;

    svg.selectAll("path").each(function(d) {
        if (d.n === topNode) {
            currentNode = d; // 該当ノードを取得
        }
    });

    if (!currentNode) {
        console.error(`Node with n=${topNode} not found in the current tree.`);
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
        body: JSON.stringify({ n: topNode })
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

        clickablePaths.on("click", click)
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
    
        //previousTopNode = d;

        // ラベルを再描画
        svg.selectAll("text")
            .data(nodes.filter(d => {
                const r = y(d.y + d.dy / 2);
                const theta = x(d.x + d.dx) - x(d.x);
                return r * theta >= labelCriterion; // ラベル表示基準を満たすノードのみ
            }))
            .enter().append("text")
            .attr("transform", d => "translate(" + arc.centroid(d) + ")")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .text(d => d.name);

        //previousClickDepth = clicknodeDepth;
        // ドラッグバーを追加
        var drag = initializeDrag(nodes, arc, parentNode); // ドラッグ設定を適用
        draggableBar.call(drag); // ドラッグバーに適用
    
        // ラベル再描画
        updateLabels(nodes, arc);
        updateNodeCount(nodes);
    })
    .catch(error => console.error("Error fetching subtree:", error));
}
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
        if (config.topNode) {
            initializeGraphWithTopNode(config.topNode);
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
        .style("top", mainSvg.style("top"))
        .style("left", mainSvg.style("left"))
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
    
    clickablePaths.on("click", click)
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
    
    var drag = initializeDrag(nodes, arc, parentNode=NaN); // ドラッグ設定を適用
    draggableBar.call(drag); // ドラッグ可能なバーに適用
    
    updateLabels(nodes, arc); // ラベルを初期描画
    
    updateNodeCount(nodes);
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
    //var startAngle = x(d.x);
    //var endAngle = x(d.x + d.dx);
    //let initialColor = d3.select(this).style("fill");
    var clickedNodeParent = d.parent;
    //console.log("Clicked Node", d.name);
    
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
        console.log(`${node.parent.name}:${previousDepth}`);
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
                    .each("end", function() {
                        finalizeUpdate(nodes, parentNode);
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
            
                clickablePaths.on("click", click)
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
    
            clickablePaths.on("click", click)
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
    
            // ラベルを再描画
            svg.selectAll("text")
                .data(nodes.filter(d => {
                    const r = y(d.y + d.dy / 2);
                    const theta = x(d.x + d.dx) - x(d.x);
                    return r * theta >= labelCriterion; // ラベル表示基準を満たすノードのみ
                }))
                .enter().append("text")
                .attr("transform", d => "translate(" + arc.centroid(d) + ")")
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .text(d => d.name);
    
            previousClickDepth = clicknodeDepth;
            finalizeUpdate(nodes, parentNode)
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
        offset -= opposingAngle; // クリックによるオフセットを調整
        var clickedNodeParent = d.parent;
        var stepdepth = predepth + d.depth;
        console.log(`${d.name}の真の深さ：${stepdepth}`);
        // 現在の深さを保存して次回のクリック時に使用
        //previousDepth = nodeDepth;
        console.log("Clicked Node", d.name);
        // 既存の path の色を保存
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
            //console.log(`Response size: ${contentLength} bytes`);  // 受信データのサイズを表示
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
        
            clickablePaths.on("click", click)
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
                .duration(5000)
                .style("opacity", 0);

                // トランジション中はクリックとホバーを無効化
                svg.selectAll("path")
                    .on("click", null)
                    .on("mouseover", null)
                    .on("mouseout", null);
            
                svg.transition()
                    //.delay(4000)
                    .duration(5000)
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
                            finalizeUpdate(nodes, parentNode)
                
                            // 次のノードの startAngle と endAngle を求める
                            var nextStartAngle, nextEndAngle;
                            if (nextNodeName) {
                                const nextNode = nodes.find(n => n.name === nextNodeName);
                                if (nextNode) {
                                    nextStartAngle = x(nextNode.x);
                                    nextEndAngle = x(nextNode.x + nextNode.dx);
                                }
                            }
                
                            // 次のステップ（固定の step イベント）を呼び出し
                            dispatch.step(nextStartAngle, nextEndAngle);
                            // トランジション終了後にクリックとホバーを再有効化
                            svg.selectAll("path")
                                .on("click", click)
                                .on("mouseover", mouseover)
                                .on("mouseout", mouseout);
                        }
                    });

            subtreeNodeNames = nodes.map(d => d.name);
            updateNodeCount(nodes);
            previousClickDepth = stepdepth; // clicknodeDepth
            //console.log(`${d.name}クリック後の深さ：${previousClickDepth}`);
        })
        .catch(error => console.error("Error fetching subtree data:", error));
        }
        function finalizeUpdate(nodes, parentNode) {
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
                    .on("click", click)
                    .on("mouseover", mouseover)
                    .on("mouseout", mouseout);
            }
            // ドラッグバーを追加
            var drag = initializeDrag(nodes, arc, parentNode); // ドラッグ設定を適用
            draggableBar.call(drag); // ドラッグバーに適用
        
            // ラベル再描画
            updateLabels(nodes, arc);
            updateNodeCount(nodes);
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
function fetchAncestors(name) {
    // 祖先情報を取得
    fetch('/ancestor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name })
    })
    .then(response => response.json())
    .then(data => {
        const selectedNodeData = data.ancestors.find(node => node.name === name);
    
        if (!selectedNodeData) {
            alert("選択されたノードの情報が見つかりませんでした。");
            return;
        }
    
        const ancestors = selectedNodeData.ancestors;
        document.getElementById('ancestorDisplay').innerText =
            `選択ノード: ${name}, 先祖: ${ancestors.join(" -> ")}`;
    
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
    //var ex = x(d.x + d.dx);
    //var sx = x(d.x);
    var theta = x(d.x + d.dx) - x(d.x); // Angle in radians
    var rTheta = r * theta;
    
    tooltip.style("visibility", "visible")
    .html(`Node: ${d.name}<br>Value: ${d.value}<br>${d.is_merged ? 'Merged count: ' + d.merge_count + '<br>' : ''}r: ${r.toFixed(2)}(${y(d.dy)}), θ: ${theta.toFixed(2)}<br>r * θ: ${rTheta.toFixed(2)}<br>Color (CIELab): ${labColor.toString()}`);
    
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