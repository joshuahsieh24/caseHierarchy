import LightningDatatable from 'lightning/datatable';
import picklistTemplate from './picklistType.html';

export default class DatatablePicklist extends LightningDatatable {
    static customTypes = {
        picklist: {
            template: picklistTemplate,
            standardCellLayout: true,
            typeAttributes: ['options', 'value', 'placeholder', 'context']
        }
    };

    handlePicklistChange(event) {
        event.stopPropagation();
        event.preventDefault();

        const value = event.detail.value;
        const rowKey = event.target.dataset.context;
        
        // Get the column field name from the datatable's internal structure
        const colKey = this._columnDefinition?.fieldName;

        console.log('Picklist change:', { value, rowKey, colKey, columnDef: this._columnDefinition });

        if (!colKey) {
            console.error('Could not determine column field name');
            return;
        }

        // Create the draft values in the format expected by lightning-datatable
        const draftValues = [{ 
            _id: rowKey, 
            [colKey]: value 
        }];

        // Dispatch the custom event that lightning-datatable expects
        this.dispatchEvent(new CustomEvent('privateeditcustomcellchange', {
            bubbles: true, 
            composed: true, 
            cancelable: true,
            detail: {
                rowKeyValue: rowKey,
                draftValues: draftValues
            }
        }));
    }
}