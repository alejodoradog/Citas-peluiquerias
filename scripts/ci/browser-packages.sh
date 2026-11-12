#!/usr/bin/env bash
# The Playwright browsers and the system packages they need, on a GitHub
# runner. The packages come from the Ubuntu mirrors, which the runners
# sometimes cannot reach for hours ("Temporary failure resolving
# 'archive.ubuntu.com'"). So the workflow "Browser packages" downloads them
# once from main and keeps the .deb files in a cache that every pull request
# reads (.github/workflows/browser-packages.yml).
#
#   browser-packages.sh install   CI: from the cached .deb files when there
#                                 are, else from the mirrors with retries.
#   browser-packages.sh collect   From the mirrors, keeping the .deb files
#                                 in $DEBS for the cache.
set -uo pipefail

DEBS="${BROWSER_DEBS:-$HOME/browser-debs}"
BROWSERS=(chromium webkit)

# Each try gets 8 minutes; a try that times out leaves apt running, so it is
# stopped and its lock released before the next one.
from_mirrors() {
  for try in 1 2 3; do
    if timeout -k 15 480 pnpm exec playwright install --with-deps "${BROWSERS[@]}"; then
      return 0
    fi
    echo "::warning::Browser install try $try did not finish"
    sudo pkill -9 -f 'apt-get|dpkg' || true
    sudo rm -f /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock
    sudo dpkg --configure -a || true
  done
  return 1
}

from_cache() {
  compgen -G "$DEBS/*.deb" > /dev/null || return 1
  echo "Installing $(ls "$DEBS"/*.deb | wc -l) cached system packages"
  sudo dpkg -i --skip-same-version "$DEBS"/*.deb || return 1
  # The browsers themselves come from Playwright's own servers, not apt.
  timeout -k 15 480 pnpm exec playwright install "${BROWSERS[@]}"
}

case "${1:-}" in
  install)
    if from_cache; then exit 0; fi
    echo "::warning::No usable cached packages; downloading them"
    from_mirrors
    ;;
  collect)
    # Keep what apt downloads (the runner image may clean it up).
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' |
      sudo tee /etc/apt/apt.conf.d/99keep-debs > /dev/null
    sudo rm -f /etc/apt/apt.conf.d/docker-clean
    sudo rm -f /var/cache/apt/archives/*.deb
    from_mirrors || exit 1
    mkdir -p "$DEBS"
    cp /var/cache/apt/archives/*.deb "$DEBS"/ 2> /dev/null || true
    count=$(compgen -G "$DEBS/*.deb" | wc -l)
    echo "Kept $count packages"
    [ "$count" -gt 0 ]
    ;;
  *)
    echo "usage: $0 install|collect" >&2
    exit 2
    ;;
esac
