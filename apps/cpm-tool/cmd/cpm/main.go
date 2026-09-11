// Command cpm is the cpm tool for real computers: it packs and publishes
// packages to the cpm registry.
package main

import (
	"os"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/cli"
)

func main() {
	os.Exit(cli.Execute())
}
