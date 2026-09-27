import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const BASE = `${import.meta.env.BASE_URL}models/`

const FILES = {
  house: 'house.glb',
  tree: 'tree.glb',
} as const

export type AssetName = keyof typeof FILES
export type Assets = Record<AssetName, GLTF>

export async function loadAssets(): Promise<Assets> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const names = Object.keys(FILES) as AssetName[]
  const loaded = await Promise.all(names.map((n) => loader.loadAsync(BASE + FILES[n])))
  const out = {} as Assets
  names.forEach((n, i) => {
    out[n] = loaded[i]
  })
  return out
}
