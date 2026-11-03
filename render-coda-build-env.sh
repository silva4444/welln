# CODA Render build override
# Keeps the existing Render service/build command but replaces only the legacy CODA package URL.
CODA_REAL_CURL="$(type -P curl)"
CODA_OLD_PACKAGE="https://media.base44.com/files/public/6adfa0d4abd10f5201650211/d36171453_CODA-ESP32-3D-Editor-Arduino-v143.zip"
CODA_NEW_PACKAGE="https://media.base44.com/files/public/6adfa0d4abd10f5201650211/e8d42474c_CODA-Quest-Studio-Meta-Quest3-v150.zip"

curl() {
  local replaced=()
  local arg
  for arg in "$@"; do
    if [[ "$arg" == "$CODA_OLD_PACKAGE" ]]; then
      replaced+=("$CODA_NEW_PACKAGE")
    else
      replaced+=("$arg")
    fi
  done
  "$CODA_REAL_CURL" "${replaced[@]}"
}
export CODA_REAL_CURL CODA_OLD_PACKAGE CODA_NEW_PACKAGE
export -f curl
