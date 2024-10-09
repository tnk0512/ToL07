from flask import Flask, request, jsonify, render_template
import json
import copy
from pathlib import Path

app = Flask(__name__)

class TreeOfLife:
    # Load the TreeOfLife data
    with open('static/data/tree_of_lives_withValue.json') as f:
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

    def subtree(self, name=None, n=None, depth=2**32):
        if type(name) == str: life = self.life(name=name)
        elif type(n) == int: life = self.life(n=n)
        else: return
    
        # リーフノードを格納するリスト
        leaf_nodes = []
    
        def build_subtree(life, depth):
            if depth <= 0:
                life_copy = copy.deepcopy(life)
                life_copy['children'] = []  # リーフノードとして扱う
                leaf_nodes.append(life['n'])
                return life_copy
    
            subtree = {
                'n': life['n'],
                'parent': life['parent'],
                'name': life['name'],
                'value': life['value'],
                'children': [build_subtree(self.life(n=c), depth-1) for c in life['children']]
            }
            return subtree
    
        life_tree = build_subtree(life, depth)
        return life_tree, leaf_nodes
    
    def subtrees(self, ns=[], depth=1):
        return dict(zip(ns, [self.subtree(n=n, depth=depth) for n in ns]))

# ノード合体の関数
def merge_small_nodes(node, root_value):
    threshold = root_value / 1000
    new_children = []
    merge_group = []
    
    for child in node.get('children', []):
        if child['value'] <= threshold:
            merge_group.append(child)
        else:
            # 合体する必要のないノード
            if merge_group:
                # 合体ノードを作成
                merged_node = {
                    'name': f"Merged-{merge_group[0]['name']}",  # 左端の名前を使用
                    'value': sum(c['value'] for c in merge_group),  # 合計値
                    'children': [],
                    'is_merged': True,  # 合体ノードにフラグを付ける
                    'merge_count': len(merge_group)  # 合体したノードの数をカウント
                }
                new_children.append(merged_node)
                merge_group = []
            new_children.append(child)
    
    # 最後の合体ノードが残っている場合
    if merge_group:
        merged_node = {
            'name': f"Merged-{merge_group[0]['name']}",
            'value': sum(c['value'] for c in merge_group),
            'children': [],
            'is_merged': True,
            'merge_count': len(merge_group)
        }
        new_children.append(merged_node)
    
    node['children'] = new_children
    for child in node['children']:
        merge_small_nodes(child, root_value)

# リーフノードのchildrenを変換する関数
def convert_leaf_nodes(node, leaf_nodes):
    if node["n"] in leaf_nodes:
        #print(node["n"])
        subtree, _ = ToL.subtree(n=node["n"], depth=1)  # 返り値はタプル
        node["children"] = subtree["children"]
    elif "children" in node:
        for child in node["children"]:
            convert_leaf_nodes(child, leaf_nodes)
    return node

ToL = TreeOfLife()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data', methods=['POST'])
def get_subtree():
    name = 'Biota' # ここを変える！！
    depth = 4
    subtree, leaf_nodes = ToL.subtree(name=name, depth=depth)

    # 合体処理を適用
    merge_small_nodes(subtree, subtree['value'])
    return jsonify({"life": subtree, "leaf_nodes": leaf_nodes})

@app.route('/subtree', methods=['POST'])
def get_subtree_on_click():
    data = request.get_json()
    name = data['name']
    # クリックされたノードを取得
    clicknode = ToL.life(name=name)
    newtree, _ = ToL.subtree(name=name, depth=4)
    # 合体処理を適用
    merge_small_nodes(newtree, newtree['value'])
    parent = ToL.life(n=clicknode['parent']) if clicknode['parent'] != -1 else None
    return jsonify({"newtree": newtree, "parent": parent})


'''
@app.route('/subtree', methods=['POST'])
def get_subtree_on_click():
    data = request.get_json()
    name = data['name']
    
    # クリックされたノードを取得
    clicknode = ToL.life(name=name)
    
    # クリックされたノードの親ノードの部分ツリーを取得
    pretree, _ = ToL.subtree(n=clicknode['parent'], depth=4)
    
    # クリックされたノードの部分ツリーを取得し、3レベル下までのリーフノードを取得
    _, leaf_nodes = ToL.subtree(name=name, depth=3)
    #print(leaf_nodes)
    
    # 新しいJSONデータを作成
    newtree = convert_leaf_nodes(pretree, leaf_nodes)
    #print(newtree)

    parent = ToL.life(n=clicknode['parent']) if clicknode['parent'] != -1 else None
    return jsonify({"newtree": newtree, "parent": parent})
'''

@app.route('/parentclick', methods=['POST'])
def parentclick():
    data = request.get_json()
    name = data['name']
    # クリックされたノードを取得
    clicknode = ToL.life(name=name)

    # 親ノードのツリーを深さ4まで取得
    newtree, _ = ToL.subtree(name=name, depth=4)
    # 合体処理を適用
    merge_small_nodes(newtree, newtree['value'])

    # 親ノードを取得
    parent = ToL.life(n=clicknode['parent']) if clicknode['parent'] != -1 else None

    return jsonify({"newtree": newtree, "parent": parent})

if __name__ == '__main__':
    app.run(debug=True)
