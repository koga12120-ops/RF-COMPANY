with open('src/components/views/MarketsView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const [type, setType] = useState<'market' | 'warehouse'>('market');\n  const [type, setType] = useState<'market' | 'warehouse'>('market');",
    "const [type, setType] = useState<'market' | 'warehouse'>('market');"
)

with open('src/components/views/MarketsView.tsx', 'w') as f:
    f.write(content)
