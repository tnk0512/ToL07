from flask import Flask, request, jsonify, render_template
import json
import copy
from pathlib import Path
import random
import pandas as pd

app = Flask(__name__)

class TreeOfLife:
    # Load the TreeOfLife data
    with open('static/data/tree_of_lives_withValue.json') as f:
    #with open('static/data/simple_withValue.json') as f:
        ToL_data = json.load(f)

    def __init__(self):
        data = self.ToL_data
        self.lives = data['lives']
        self.index = data['index']
        self.lookup = data['lookup']
        self.orphans = data['orphans']

    def life(self, name=None, n=None):
        if type(name) == str: n = self.lookup[name]
        if type(n) == int:
            return self.lives[n]

    def subtree(self, name=None, n=None, depth=2**32, merge_factor=1000): # 2090000 or 1000
        if type(name) == str: life = self.life(name=name)
        elif type(n) == int: life = self.life(n=n)
        else: return
    
        # リーフノードを格納するリスト
        leaf_nodes = []
        # 合体の閾値    
        root_value = life['value']
        threshold = root_value / merge_factor
    
        def build_subtree(life, depth):
            if depth <= 0:
                life_copy = copy.deepcopy(life)
                life_copy['children'] = []  # リーフノードとして扱う
                leaf_nodes.append(life['n'])
                return life_copy
            
            # 子ノードの処理
            children = []
            merge_group = []

            for c in life['children']:
                child_life = self.life(n=c)
                
                if child_life['value'] <= threshold:
                    merge_group.append(child_life)
                else:
                    if merge_group:
                        # 合体ノードを作成
                        merged_node = {
                            'n': None,
                            'parent': life['n'],
                            'name': f"Merged-{merge_group[0]['name']}",
                            'value': sum(c['value'] for c in merge_group),
                            'children': [],
                            'is_merged': True,
                            'merge_count': len(merge_group)
                        }
                        children.append(merged_node)
                        merge_group = []
                    children.append(build_subtree(child_life, depth-1))
            
            # 最後の合体ノードを処理
            if merge_group:
                merged_node = {
                    'n': None,
                    'parent': life['n'],
                    'name': f"Merged-{merge_group[0]['name']}",
                    'value': sum(c['value'] for c in merge_group),
                    'children': [],
                    'is_merged': True,
                    'merge_count': len(merge_group)
                }
                children.append(merged_node)

            subtree = {
                'n': life['n'],
                'parent': life['parent'],
                'name': life['name'],
                'value': life['value'],
                'children': children
            }
            return subtree
    
        # サブツリー構築
        life_tree = build_subtree(life, depth)
        
        return life_tree, leaf_nodes
    
    def subtrees(self, ns=[], depth=1):
        return dict(zip(ns, [self.subtree(n=n, depth=depth) for n in ns]))
    
    # 先祖をたどる関数を部分一致に対応
    # 先祖をたどる関数（部分一致検索 + `n` 検索に対応）
    def ancestor(self, name=None, n=None):
        matches = []
    
        if name:
            # 部分一致検索（name）
            matches = [node for node in self.lives if name.lower() in node["name"].lower()]
        elif n:
            # 完全一致検索（n）
            matches = [node for node in self.lives if str(node["n"]) == str(n)]
    
        if not matches:
            return ["指定された学名またはIDが見つかりませんでした"]
    
        # すべての一致したノードの祖先を収集
        all_ancestors = []
        for match in matches:
            node = match
            ancestors = []
            while node["parent"] is not None and node["n"] != -1:
                ancestors.append(node["name"])
                node = self.life(n=node["parent"])  # 親ノードを取得
            all_ancestors.append({
                "name": match["name"],
                "n": match["n"],
                "ancestors": ancestors[::-1]  # ルートから順序に
            })
    
        return all_ancestors


ToL = TreeOfLife()
selected_node = 2429906  # グローバル変数で初期値を設定

@app.route('/ToL')
def render_tree():
    # URLパラメータを取得
    color_change = request.args.get('colorChange', 'true').lower() == 'true'
    animation = request.args.get('animation', 'false').lower() == 'true'
    ease = request.args.get('ease', 'false').lower() == 'true'
    timing = request.args.get('timing', None)
    depth = request.args.get('depth', None)
    task = request.args.get('task', None)
    tasknum = request.args.get('tasknum', random.randint(0, 39))
    taskMode = depth is not None or task is not None

    # サブツリーの初期ノードをランダムに選択
    if depth:
        depth = int(depth)
        _, lst = ToL.subtree(name="Biota", depth=depth)
        
        if depth>2:
            # 偏りを持たせるためにウェイトを設定
            weights = [1 / (i + 1) for i in range(len(lst))]  # 例: ノードインデックスが小さいほど高い確率
            selected_node = random.choices(lst, weights=weights, k=1)[0]
        else:
            # 一様分布の場合
            selected_node = random.choice(lst)
    else:
        selected_node = 2429906  # デフォルト値

    return render_template(
        'index.html',
        colorChange=color_change,
        animation=animation,
        ease=ease,
        timing=timing,
        topNode=selected_node,
        interaction='true',
        taskMode=taskMode,
        task=task,
        tasknum=tasknum,
        score=0
    )

@app.route('/data', methods=['POST'])
def get_subtree():
    data = request.get_json()
    selected_node = data.get('n', 2429906)  # デフォルト値を設定
    #selected_node = request.args.get('topNode', 2429906)
    depth = 4
    subtree, leaf_nodes = ToL.subtree(n=2429906, depth=depth)
    # subtree, leaf_nodes = ToL.subtree(name=name, depth=depth)

    return jsonify({"life": subtree, "leaf_nodes": leaf_nodes})
    

@app.route('/subtree', methods=['POST'])
def get_subtree_on_click():
    data = request.get_json()
    n = data['n']
    print(f'{n}の木を表示')
    # クリックされたノードを取得
    clicknode = ToL.life(n=n)
    newtree, _ = ToL.subtree(n=n, depth=4)

    parent = ToL.life(n=clicknode['parent']) if clicknode['parent'] != -1 else None
    return jsonify({"newtree": newtree, "parent": parent})  # ここが遅い

@app.route('/ToL/top', methods=['GET'])
def get_subtree_by_top():
    # URLパラメータで指定されたノード名を取得
    top_node_name = request.args.get('top', None)
    if not top_node_name:
        return jsonify({"error": "Top node not specified"}), 400

    # ノード名から対応するサブツリーを取得
    try:
        top_node = ToL.find_by_name(top_node_name)
        if not top_node:
            return jsonify({"error": "Top node not found"}), 404

        newtree, _ = ToL.subtree(n=top_node['id'], depth=4)
        return jsonify({"newtree": newtree, "topNode": top_node})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/load_task_data', methods=['GET'])
def load_task_data():
    # URLパラメータからタスク種類を取得
    task_type = request.args.get('task', None)
    if not task_type:
        return jsonify({"error": "Task type is not specified"}), 400

    # タスク種類に応じてCSVを選択
    csv_file_map = {
        "size1": "static/data/test/size1.csv",
        "size2": "static/data/test/size2.csv",
        "size3": "static/data/test/size3.csv",
        "size4": "static/data/test/size4.csv",
        "hierarchical": "static/data/test/hierarchy.csv",
    }

    if task_type not in csv_file_map:
        return jsonify({"error": f"Invalid task type: {task_type}"}), 400

    try:
        # CSVファイルを読み込む
        task_data = pd.read_csv(csv_file_map[task_type])
        return jsonify(task_data.to_dict(orient='records'))
    except Exception as e:
        return jsonify({"error": f"Failed to load task data: {str(e)}"}), 500

@app.route('/parentclick', methods=['POST'])
def parentclick():
    data = request.get_json()
    n = data['n']
    # クリックされたノードを取得
    clicknode = ToL.life(n=n)

    # 親ノードのツリーを深さ4まで取得
    newtree, _ = ToL.subtree(n=n, depth=4)

    # 親ノードを取得
    parent = ToL.life(n=clicknode['parent']) if clicknode['parent'] != -1 else None

    return jsonify({"newtree": newtree, "parent": parent})


@app.route('/search', methods=['POST'])
def search_nodes():
    data = request.get_json()
    query = data.get('query', '').lower()

    # 条件: value >= 100 のノードのみ検索対象 + 部分一致 + 単語の先頭から一致
    matches = [
        node["name"] for node in ToL.lives
        if query in [word.lower() for word in node["name"].split()]  # 完全一致
        #if any(word.lower().startswith(query) for word in node["name"].split())  # 初め一致
    ]
    
    return jsonify({"matches": matches})
    

@app.route('/ancestor', methods=['POST'])
def get_ancestor():
    data = request.get_json()
    name = data.get('name')
    node_id = data.get('n')

    if name:
        ancestors = ToL.ancestor(name=name)
    elif node_id:
        ancestors = ToL.ancestor(n=node_id)

    else:
        return jsonify({"error": "無効なリクエスト"}), 400

    return jsonify({"ancestors": ancestors})


if __name__ == '__main__':
    app.run(debug=True)
