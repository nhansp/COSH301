#include <iostream>
#include <algorithm>
#include <vector>
using namespace std;
#define ii pair<int, int>
#define fi first
#define se second
int main() {
    cin.tie(0) -> sync_with_stdio(0); cout.tie(0);
    int n;
    cin >> n;
    vector<ii> a(n);
    for (auto &[u, v]: a) cin >> u >> v;
    sort (a.begin(), a.end());
    int d = 0;
    for (int i = 1; i < n; ++i) {
	if (a[i].fi >= a[i - 1].fi) {
		if (a[i].se <= a[i - 1].se) continue;
		else d++;
	}
    }
    cout << d;
}

