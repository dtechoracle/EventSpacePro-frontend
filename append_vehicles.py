import json

entries = [
  {
    "id": "bike",
    "label": "Bike",
    "path": "/assets/modal/Vehicles/Bike.png",
    "category": "Vehicles",
    "width": 639,
    "height": 426,
    "name": "Bike"
  },
  {
    "id": "boat",
    "label": "Boat",
    "path": "/assets/modal/Vehicles/Boat.png",
    "category": "Vehicles",
    "width": 1000,
    "height": 549,
    "name": "Boat"
  },
  {
    "id": "vehicle-01",
    "label": "Vehicle 01",
    "path": "/assets/modal/Vehicles/Vehicle 01.png",
    "category": "Vehicles",
    "width": 3976,
    "height": 2204,
    "name": "Vehicle 01"
  },
  {
    "id": "vehicle-02",
    "label": "Vehicle 02",
    "path": "/assets/modal/Vehicles/Vehicle 02.png",
    "category": "Vehicles",
    "width": 3704,
    "height": 1920,
    "name": "Vehicle 02"
  },
  {
    "id": "vehicle-03",
    "label": "Vehicle 03",
    "path": "/assets/modal/Vehicles/Vehicle 03.png",
    "category": "Vehicles",
    "width": 3800,
    "height": 2132,
    "name": "Vehicle 03"
  },
  {
    "id": "vehicle-04",
    "label": "Vehicle 04",
    "path": "/assets/modal/Vehicles/Vehicle 04.png",
    "category": "Vehicles",
    "width": 3400,
    "height": 1776,
    "name": "Vehicle 04"
  },
  {
    "id": "vehicle-05",
    "label": "Vehicle 05",
    "path": "/assets/modal/Vehicles/Vehicle 05.png",
    "category": "Vehicles",
    "width": 3788,
    "height": 1900,
    "name": "Vehicle 05"
  },
  {
    "id": "vehicle-06",
    "label": "Vehicle 06",
    "path": "/assets/modal/Vehicles/Vehicle 06.png",
    "category": "Vehicles",
    "width": 3644,
    "height": 2060,
    "name": "Vehicle 06"
  }
]

with open('lib/assets.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# find the end of the ASSET_LIBRARY array
idx = content.rfind('];')
if idx != -1:
    before = content[:idx]
    after = content[idx:]
    
    # insert
    insert_str = ',\n' + ',\n'.join(['  ' + json.dumps(e, indent=4).replace('\n', '\n  ') for e in entries]) + '\n'
    new_content = before.rstrip() + insert_str + after
    
    with open('lib/assets.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Appended Vehicles to ASSET_LIBRARY")
else:
    print("Could not find end of ASSET_LIBRARY")
