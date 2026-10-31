# Credits

## Photos

The project photos on the hub's display-only categories (PC Build, Home Repair, Car Care, Bike Repair, Field Technician, First Aid) are from [Unsplash](https://unsplash.com) and used under the [Unsplash License](https://unsplash.com/license): free to use, including commercially, with no attribution required. We credit the photographers anyway.

Each one was downloaded once, cropped to a square and saved as WebP in `public/images/extra/`. None are hotlinked.

| Card | File | Photographer | Source |
| --- | --- | --- | --- |
| PC Build: Gaming PC build | `pc/gaming-pc-build.webp` | Petr Urbanek | https://unsplash.com/photos/open-computer-case-with-internal-components-visible-wCz-qgXgO3c |
| PC Build: Install a GPU | `pc/install-a-gpu.webp` | Nathan Anderson | https://unsplash.com/photos/black-computer-tower-on-white-table-KHSPGJ3zP0M |
| PC Build: Upgrade RAM | `pc/upgrade-ram.webp` | Luan Gjokaj | https://unsplash.com/photos/a-close-up-of-a-computer-motherboard-y4_xZ3cs96w |
| PC Build: Add an M.2 SSD | `pc/add-an-m2-ssd.webp` | Aakash Malik | https://unsplash.com/photos/computer-motherboard-with-cpu-cooler-and-ssd-fkbFXR00nic |
| Home Repair: Fix a leaky faucet | `home/fix-a-leaky-faucet.webp` | Walter Randlehoff | https://unsplash.com/photos/yGKWUI1nSos |
| Home Repair: Install a light switch | `home/install-a-light-switch.webp` | Fabian Kleiser | https://unsplash.com/photos/exposed-electrical-wiring-inside-a-wall-CW0T7Rce2SA |
| Home Repair: Patch drywall | `home/patch-drywall.webp` | Sasun Bughdaryan | https://unsplash.com/photos/hands-applying-plaster-to-a-wall-with-trowels-Re1O5byZ8bY |
| Car Care: Change a tire | `car/change-a-tire.webp` | Sincerely Media | https://unsplash.com/photos/a-man-working-on-a-tire-with-a-wrench-Ou_JxayY8dQ |
| Car Care: Check engine oil | `car/check-engine-oil.webp` | Erik Mclean | https://unsplash.com/photos/a-man-is-working-on-a-car-engine-7wxJ05iJcsY |
| Car Care: Replace wiper blades | `car/replace-wiper-blades.webp` | Thibault Valjevac | https://unsplash.com/photos/shallow-focus-photography-of-black-vehicle-wiper-2m6GjKScw20 |
| Bike Repair: Fix a flat tire | `bike/fix-a-flat-tire.webp` | Anton Savinov | https://unsplash.com/photos/a-close-up-of-a-bike-tire-on-a-concrete-slab-DeurQWSxhFQ |
| Bike Repair: Adjust brakes | `bike/adjust-brakes.webp` | Rafał Karoń | https://unsplash.com/photos/a-close-up-view-of-a-bikes-brake-FGWywns8Zas |
| Bike Repair: Clean and oil the chain | `bike/clean-and-oil-the-chain.webp` | Anton Savinov | https://unsplash.com/photos/a-man-holding-a-chain-odmhAAmEfDU |
| Field Technician: HVAC filter service | `field/hvac-filter-service.webp` | Everett Pachmann | https://unsplash.com/photos/a-white-air-conditioner-sitting-on-top-of-a-brick-wall-JsPkVrHMQoo |
| Field Technician: Solar panel mount | `field/solar-panel-mount.webp` | Bill Mead | https://unsplash.com/photos/person-installing-solar-panel-on-roof-wmaP3Tl80ww |
| Field Technician: Network rack wiring | `field/network-rack-wiring.webp` | Jordan Harrison | https://unsplash.com/photos/blue-utp-cord-40XgDxBfYXM |
| First Aid: Build a first-aid kit | `aid/build-a-first-aid-kit.webp` | Mat Napo | https://unsplash.com/photos/open-red-medical-bag-with-supplies-MaKsx8JNbiI |
| First Aid: Use an AED | `aid/use-an-aed.webp` | Frederick Shaw | https://unsplash.com/photos/person-practicing-cpr-on-a-training-dummy-E2JjBMyxBVw |
| First Aid: Put on PPE | `aid/put-on-ppe.webp` | Jan Kopřiva | https://unsplash.com/photos/a-person-wearing-a-white-suit-and-blue-gloves-EXWhFRxYlj8 |

## Marker tracking

Marker detection uses [js-aruco2](https://github.com/damianofalcioni/js-aruco2), pinned at 2.0.0. Used aruco.js/cv.js carry MIT notices, copyright Damiano Falcioni / Juan Mellado. The package LICENSE.txt includes upstream and unused POSIT/SVD notices; those modules are not imported. Generated marker patterns use the ARUCO_MIP_36h12 dictionary. No additional model/texture assets were added.
