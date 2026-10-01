import re

with open('store/projectStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

types_to_update = ['export type Group = {', 'export type Shape = {', 'export type Asset = {', 'export type Wall = {', 'export type TextAnnotation = {', 'export type LabelArrow = {', 'export interface Dimension {']

for t in types_to_update:
    content = content.replace(t, t + '\n    locked?: boolean;')

with open('store/projectStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated projectStore.ts')
