#!/bin/bash
set -e

git config merge.beads.driver 'bd merge %A %O %B %A'
git config merge.beads.name 'bd JSONL merge driver'
