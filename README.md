# TreeOfLife クラスのメソッド説明

`TreeOfLife` クラスは、木構造データを操作するためのクラスです。このクラスには、特定のノード（生命体）の情報を取得するための `life` メソッド、部分木を取得するための `subtree` メソッド、複数の部分木を取得するための `subtrees` メソッドが含まれています。

## クラス変数
- `lives`: 木構造の各ノード（生命体）のリスト。
- `index`: IDとノードのインデックスの対応表。
- `lookup`: 学名とノードのインデックスの対応表。
- `orphans`: 親IDが存在しない孤児ノードのリスト。

## `life` メソッド
`life` メソッドは特定の生命体（ノード）の情報を取得するためのメソッドです。

### 引数
- `name`: 学名（オプション）。
- `n`: ノードのインデックス（オプション）。

### 処理
- `name` が文字列の場合、その学名に対応するインデックスを `lookup` から取得します。
- `n` が整数の場合、そのインデックスに対応するノードの情報を `lives` から取得して返します。

### 例
```python
def life(self, name=None, n=None):
    if type(name) == str: n = self.lookup[name]
    if type(n) == int:
        return self.lives[n]
## `subtree` メソッド
`subtree` メソッドは特定のノードをルートとする部分木を取得するためのメソッドです。

### 引数
- `name`: 学名（オプション）。
- `n`: ノードのインデックス（オプション）。
- `depth`: 部分木の深さ（デフォルトは無制限）。

### 処理
- `name` が文字列の場合、その学名に対応するノードを `life` メソッドで取得します。
- `n` が整数の場合、そのインデックスに対応するノードを `life` メソッドで取得します。
- 指定された深さまで再帰的に子ノードを取得し、部分木を構築します。
- リーフノード（深さが0になるノード）は子ノードを持たないようにします。
- 部分木とリーフノードのリストを返します。

### 例
```python
def subtree(self, name=None, n=None, depth=2**32):
    if type(name) == str: life = self.life(name=name)
    elif type(n) == int: life = self.life(n=n)
    else: return
    
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
