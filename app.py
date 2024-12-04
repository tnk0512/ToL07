from flask import Flask, request, jsonify, render_template
import json
import copy
from pathlib import Path

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

    def subtree(self, name=None, n=None, depth=2**32, merge_factor=1000):
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
    def ancestor(self, name=None):
        # 部分一致検索
        matches = [node for node in self.lives if name.lower() in node["name"].lower()]
        
        if not matches:
            return ["指定された学名が見つかりませんでした"]
    
        # すべての一致したノードの祖先を収集
        all_ancestors = []
        for match in matches:
            node = match
            ancestors = []
            while node["parent"] is not None and node["n"] != -1:
                ancestors.append(node["name"])
                node = self.life(n=node["parent"])
            all_ancestors.append({
                "name": match["name"],
                "ancestors": ancestors[::-1]  # ルートから順序に
            })
    
        return all_ancestors
    '''
    # 先祖をたどる関数を追加
    def ancestor(self, name=None):
        node = self.life(name=name)
        ancestors = []

        # ノードが存在しない場合のチェック
        if node is None:
            return ["指定された学名が見つかりませんでした"]

        # 先祖をたどるループ
        while node["parent"] is not None and node["n"] != -1:
            ancestors.append(node["name"])
            node = self.life(n=node["parent"])
            # ルートノードや親ノードが見つからない場合のエラーチェック
            if node is None:
                ancestors.append("親ノードが見つかりません")
                break
        return ancestors
        '''

ToL = TreeOfLife()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data', methods=['POST'])
def get_subtree():
    #n = -1
    name = 'Biota' # ここを変える！！Biotaか1
    depth = 4
    #subtree, leaf_nodes = ToL.subtree(n=n, depth=depth)
    subtree, leaf_nodes = ToL.subtree(name=name, depth=depth)

    return jsonify({"life": subtree, "leaf_nodes": leaf_nodes})

@app.route('/subtree', methods=['POST'])
def get_subtree_on_click():
    data = request.get_json()
    n = data['n']
    # クリックされたノードを取得
    clicknode = ToL.life(n=n)
    newtree, _ = ToL.subtree(n=n, depth=4)

    parent = ToL.life(n=clicknode['parent']) if clicknode['parent'] != -1 else None
    return jsonify({"newtree": newtree, "parent": parent})  # ここが遅い

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
    ancestors = ToL.ancestor(name)
    return jsonify({"ancestors": ancestors})

if __name__ == '__main__':
    app.run(debug=True)
