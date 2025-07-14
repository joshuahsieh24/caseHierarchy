import { LightningElement, api, wire } from 'lwc';
// Import Apex controller method
import getHierarchy from '@salesforce/apex/KD_CaseHierarchyController.getHierarchy';

// Define the columns used in the tree grid
const COLUMNS = [
    { label: 'Case Number', fieldName: 'caseNumber' },
    { label: 'Subject', fieldName: 'subject' },
    { label: 'Status', fieldName: 'status' }
];

export default class KdCaseHierarchyExplorer extends LightningElement {
    // Gets automatically set to the Case record's Id when on a Case Record Page
    @api recordId;

    // Columns config for the tree grid
    columns = COLUMNS;

    // Expanded row IDs (use case ID from your hardcoded Apex root node)
    expandedRows = ['500xxx1'];

    // Wire Apex method to get hierarchy data and assign it to this.treeData
    @wire(getHierarchy, { recordId: '$recordId' })
    treeData;
}
