import json

transcript_path = r'C:\Users\Jeremiah\.gemini\antigravity\brain\2c0033e3-822b-412a-99ff-87afd61c733a\.system_generated\logs\transcript_full.jsonl'

found = False
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('step_index') == 2058:
                content = data.get('content', '')
                start = content.find('{"name":"Chika')
                if start != -1:
                    # Find the end of JSON block
                    end = content.rfind('}') + 1
                    while end > start:
                        try:
                            json_str = content[start:end]
                            parsed = json.loads(json_str)
                            with open('scratch/chika_raw.json', 'w', encoding='utf-8') as out:
                                json.dump(parsed, out, indent=2)
                            print(f'Successfully wrote chika_raw.json. canvasAssets count: {len(parsed.get("canvasAssets", []))}')
                            found = True
                            break
                        except json.JSONDecodeError:
                            end = content.rfind('}', start, end - 1) + 1
                if found:
                    break
        except Exception as e:
            print('Error parsing line:', e)

if not found:
    print('Failed to locate valid JSON payload at step 2058')
