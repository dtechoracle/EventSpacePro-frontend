// Test script to verify modification handling
// Run this in browser console after selecting an asset

// 1. Get the selected asset ID
const selectedAssets = window.__SELECTED_ASSETS__ || [];
console.log('Selected assets:', selectedAssets);

// 2. Create a test modification
const testPlan = {
    modifications: [{
        assetId: selectedAssets[0]?.id || 'test-id',
        widthMm: 2000,
        heightMm: 2000
    }]
};

// 3. Test if applyPlan would work
console.log('Test plan:', testPlan);
console.log('This should trigger modification handling');

// To actually test, you need to call applyPlan from AiTrigger
// But we can check if the store update function exists
console.log('updateAsset function exists:', typeof window.__PROJECT_STORE__?.getState().updateAsset === 'function');
